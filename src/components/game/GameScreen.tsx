'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BoardView } from '@/components/game/BoardView';
import { MoveLog, MovePreview, Rack, ScoreBar } from '@/components/game/Panels';
import { BagSheet, ExchangeSheet, PickerSheet, primaryBtn, RulesSheet, secondaryBtn } from '@/components/game/Sheets';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { useDictionary } from '@/hooks/useDictionary';
import { isTypedLetter, isTypedMark, Notice, useGame } from '@/hooks/useGame';
import { cellKey, isMainRow } from '@/lib/game/board';
import { GRID_ROWS } from '@/lib/game/constants';
import type { BotLevel } from '@/lib/game/bot';
import { describeSettings } from '@/lib/game/settings';
import { fromWire, GameState, MoveRecord, PlayerId, timePenalty, toWire, WireState } from '@/lib/game/state';
import { beaconLeave, getPusher, roomChannel, sendRoomEvent } from '@/lib/client/realtime';
import { clearSolo, firstTime, recordMatch, saveSolo } from '@/lib/client/storage';

const tileName = (t: string) => (t === '0' ? 'ตัวว่าง' : t);

export type GameSetup =
  | { mode: 'solo'; state: GameState; level: BotLevel; playerName: string }
  | { mode: 'online'; state: GameState; me: PlayerId; roomId: string; playerName: string; opponentName: string };

export function GameScreen({ setup, onExit, onRematch }: { setup: GameSetup; onExit: () => void; onRematch?: () => void }) {
  const { toast } = useToast();
  const { dictionary, failed: dictionaryFailed, retry } = useDictionary();
  const me: PlayerId = setup.mode === 'online' ? setup.me : 1;
  const names = useMemo<Record<PlayerId, string>>(
    () =>
      setup.mode === 'solo'
        ? { 1: setup.playerName, 2: 'บอท' }
        : ({ [setup.me]: setup.playerName, [setup.me === 1 ? 2 : 1]: setup.opponentName } as Record<PlayerId, string>),
    [setup],
  );

  const notify = useCallback((n: Notice) => toast(n.title, { body: n.body, tone: n.tone }), [toast]);

  const onChange = useCallback(
    (state: GameState, record: MoveRecord | null) => {
      if (setup.mode === 'solo') saveSolo(state, setup.level);
      else void sendRoomEvent(setup.roomId, setup.me, 'state', { state: toWire(state), record });
    },
    [setup],
  );

  const ctl = useGame({
    me,
    initial: setup.state,
    dictionary,
    botLevel: setup.mode === 'solo' ? setup.level : null,
    onChange,
    notify,
  });
  const { game } = ctl;

  const [sheet, setSheet] = useState<null | 'exchange' | 'bag' | 'rules' | 'log' | 'leave'>(null);
  const [zoomed, setZoomed] = useState(false);

  // ---- Who starts, and one-time tips ------------------------------------------------------
  const announced = useRef(false);
  useEffect(() => {
    if (announced.current || game.version !== 1 || game.history.length) return;
    announced.current = true;
    const o = game.opening;
    const starter = names[game.current];
    toast(o ? `จับเบี้ยเสี่ยงทาย: ${names[1]} ได้ “${tileName(o[1])}” ${names[2]} ได้ “${tileName(o[2])}”` : `${starter} เริ่มก่อน`, {
      body: o ? `${starter} เริ่มก่อน (ตัวว่างก่อน แล้วเรียง ก ถึง ฮ สระอยู่ท้ายสุด)` : undefined,
      ms: 4500,
    });
    if (firstTime('cursor')) {
      setTimeout(
        () => toast('เคล็ดลับ: แตะช่องว่างบนกระดานก่อน แล้วแตะเบี้ยเรียงตามคำ', { body: 'แตะช่องเดิมอีกครั้งเพื่อสลับแนวนอนและแนวตั้ง ลากเบี้ยวางหรือสลับที่ในมือก็ได้', ms: 7000 }),
        6500,
      );
    }
  }, [game, names, toast]);

  const tilesOnBoard = game.grid.reduce((n, row, r) => n + (isMainRow(r) ? row.filter(Boolean).length : 0), 0);
  const plays = game.history.filter((h) => h.kind === 'play').length;
  useEffect(() => {
    if (plays >= 2 && firstTime('clear')) {
      toast('กติกาคำคม: คำเก่าถูกยกออกจากกระดาน', { body: 'หลังลงคำแต่ละตา กระดานจะเหลือเฉพาะคำที่เพิ่งลง แล้วต่อจากคำเหล่านั้น', ms: 7000 });
    }
  }, [plays, tilesOnBoard, toast]);

  // ---- Typing on a computer keyboard ------------------------------------------------------
  const keys = useRef(ctl);
  useEffect(() => {
    keys.current = ctl;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('dialog[open]')) return;
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
      const c = keys.current;
      if (e.key === 'Enter') {
        e.preventDefault();
        void c.submit();
      } else if (e.key === 'Escape') {
        c.recallAll();
        c.clearCursor();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        c.undoLast();
      } else if (e.key.length === 1 && isTypedLetter(e.key)) {
        if (c.typeLetter(e.key)) e.preventDefault();
      } else if (e.key.length === 1 && isTypedMark(e.key)) {
        if (c.typeMark(e.key)) e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---- Online: receive the other player's moves -----------------------------------------
  const latest = useRef(game);
  useEffect(() => {
    latest.current = game;
  }, [game]);

  const online = setup.mode === 'online' ? setup : null;
  useEffect(() => {
    if (!online) return;
    const pusher = getPusher();
    if (!pusher) return;
    const { roomId, me: role, opponentName } = online;
    const name = roomChannel(roomId);
    const channel = pusher.subscribe(name);

    const onState = (data: { role: PlayerId; state: WireState; record: MoveRecord | null }) => {
      if (data.role === role || !data.state) return;
      const history = latest.current.history;
      const rec = data.record;
      const isNew = !!rec && !history.some((h) => h.n === rec.n && h.kind === rec.kind);
      ctl.receive(fromWire(data.state, isNew ? [...history, rec!] : history));
      if (!isNew) return;
      if (rec!.kind === 'play') toast(`${opponentName} ลงคำ ${(rec!.words ?? []).map((w) => `“${w.text}”`).join(' ')} +${rec!.score}`);
      else if (rec!.kind === 'exchange') toast(`${opponentName} แลกเบี้ย ${rec!.tiles} ตัว`);
      else if (rec!.kind === 'pass') toast(`${opponentName} ข้ามตา`);
    };
    const onLeave = (data: { role: PlayerId }) => {
      if (data.role !== role) ctl.opponentLeft();
    };
    // After (re)connecting, ask the other player for their latest state in case a move was missed.
    const onSubscribed = () => void sendRoomEvent(roomId, role, 'hello', { sync: true });
    const onHello = (data: { role: PlayerId; sync?: boolean }) => {
      if (data.role !== role && data.sync && latest.current.version > 1) {
        void sendRoomEvent(roomId, role, 'state', { state: toWire(latest.current), record: null });
      }
    };
    channel.bind('state', onState);
    channel.bind('leave', onLeave);
    channel.bind('hello', onHello);
    channel.bind('pusher:subscription_succeeded', onSubscribed);
    const leave = () => {
      if (latest.current.status === 'playing') beaconLeave(roomId, role);
    };
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('pagehide', leave);
      channel.unbind('state', onState);
      channel.unbind('leave', onLeave);
      channel.unbind('hello', onHello);
      channel.unbind('pusher:subscription_succeeded', onSubscribed);
      pusher.unsubscribe(name);
    };
    // ctl.receive and ctl.opponentLeft are stable callbacks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online?.roomId, online?.me]);

  // ---- Game over: record stats once ------------------------------------------------------
  const recorded = useRef<string | null>(null);
  useEffect(() => {
    if (game.status !== 'over' || recorded.current === game.id) return;
    recorded.current = game.id;
    recordMatch(game, me, setup.mode, names[me === 1 ? 2 : 1], setup.mode === 'solo' ? setup.level : undefined);
    if (setup.mode === 'solo') clearSolo();
  }, [game, me, setup, names]);

  const exit = () => {
    if (online && game.status === 'playing') void sendRoomEvent(online.roomId, online.me, 'leave');
    onExit();
  };

  const draftKeys = useMemo(() => new Set(ctl.draft.map((d) => cellKey(d.r, d.c))), [ctl.draft]);
  const lastKeys = useMemo(() => new Set(game.lastPlaced), [game.lastPlaced]);
  const grid = ctl.displayGrid;
  const canMark = useCallback(
    (r: number, c: number) => (r + 1 < GRID_ROWS && !!grid[r + 1][c]) || (r > 0 && !!grid[r - 1][c]),
    [grid],
  );

  const status =
    game.status === 'over'
      ? 'จบเกมแล้ว'
      : ctl.isMyTurn
        ? ctl.cursor
          ? 'แตะเบี้ยเรียงตามคำ หรือพิมพ์บนแป้นพิมพ์'
          : 'แตะเบี้ยแล้วแตะช่อง หรือแตะช่องก่อนแล้วแตะเบี้ยเรียงตามคำ'
        : ctl.botThinking
          ? 'บอทกำลังคิด…'
          : `รอ ${names[game.current]} เล่น…`;

  const hasTiles = ctl.draft.some((d) => d.kind === 'tile');
  const canSubmit = ctl.isMyTurn && !!ctl.evaluation && !ctl.evaluation.error && ctl.evaluation.ok && !ctl.busy;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-3 px-3 py-3 lg:flex-row lg:items-start lg:gap-6 lg:px-6 lg:py-6">
      <div className="flex w-full flex-col gap-3 lg:max-w-[640px]">
        <header className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => setSheet('leave')} className="rounded-lg px-2 py-1.5 text-sm font-medium text-kram-700 hover:bg-white">
            ‹ เมนู
          </button>
          <p className="font-display text-lg font-bold text-kram-900">
            {setup.mode === 'solo' ? 'เล่นกับบอท' : `ห้อง ${setup.roomId}`}
          </p>
          <div className="flex gap-1">
            <button type="button" onClick={() => setZoomed((z) => !z)} className="rounded-lg px-2 py-1.5 text-sm text-kram-700 hover:bg-white lg:hidden">
              {zoomed ? 'ย่อ' : 'ขยาย'}
            </button>
            <button type="button" onClick={() => setSheet('rules')} className="rounded-lg px-2 py-1.5 text-sm text-kram-700 hover:bg-white">
              วิธีเล่น
            </button>
          </div>
        </header>

        <ScoreBar game={game} me={me} names={names} turnStart={ctl.turnStart} onBag={() => setSheet('bag')} />

        <div className={zoomed ? '-mx-3 overflow-x-auto px-3 pb-1' : ''}>
          <div className={`board-frame ${zoomed ? 'board-zoomed' : ''}`}>
            <BoardView
              grid={grid}
              blanks={ctl.displayBlanks}
              draftKeys={draftKeys}
              lastKeys={lastKeys}
              cursor={ctl.isMyTurn ? ctl.cursor : null}
              canMark={canMark}
              interactive={game.status === 'playing'}
              onCell={ctl.tapCell}
            />
          </div>
        </div>

        <MovePreview evaluation={ctl.evaluation} status={status} dictionaryReady={!!dictionary} strict={game.settings.strict} />

        <Rack
          rack={ctl.rack}
          used={ctl.usedIndexes}
          selected={ctl.selected}
          onSelect={ctl.selectRack}
          onMove={ctl.moveRackTile}
          onDropToBoard={ctl.dropTile}
        />

        <div className="grid grid-cols-4 gap-2">
          <button type="button" className={secondaryBtn} onClick={ctl.recallAll} disabled={!hasTiles && ctl.draft.length === 0}>
            เก็บคืน
          </button>
          <button type="button" className={secondaryBtn} onClick={ctl.shuffleRack}>
            สลับ
          </button>
          <button type="button" className={secondaryBtn} onClick={() => setSheet('exchange')} disabled={!ctl.isMyTurn || !!ctl.busy}>
            แลกเบี้ย
          </button>
          {setup.mode === 'solo' && ctl.hints !== 0 ? (
            <button type="button" className={secondaryBtn} onClick={ctl.hint} disabled={!ctl.isMyTurn || !!ctl.busy}>
              {ctl.busy === 'hint' ? 'กำลังหา…' : ctl.hints === null ? 'คำใบ้' : `คำใบ้ (${ctl.hints})`}
            </button>
          ) : (
            <button type="button" className={secondaryBtn} onClick={() => setSheet('log')}>
              ประวัติ
            </button>
          )}
        </div>
        <button type="button" className={`${primaryBtn} py-3.5 text-base`} onClick={ctl.submit} disabled={!canSubmit}>
          {ctl.busy === 'submit'
            ? 'กำลังตรวจคำ…'
            : ctl.evaluation && !ctl.evaluation.error && ctl.evaluation.ok
              ? `ลงคำ +${ctl.evaluation.total}`
              : 'ลงคำ'}
        </button>

        {dictionaryFailed && (
          <p className="rounded-xl bg-white p-3 text-sm text-kram-700">
            โหลดพจนานุกรมไม่สำเร็จ ระบบจะตรวจคำกับเซิร์ฟเวอร์แทน{' '}
            <button type="button" className="font-semibold text-kram-900 underline" onClick={retry}>
              ลองโหลดใหม่
            </button>
          </p>
        )}
      </div>

      <aside className="hidden w-full rounded-2xl bg-white p-4 lg:block lg:max-w-sm">
        <p className="mb-3 text-xs leading-relaxed text-kram-500">{describeSettings(game.settings, { hints: setup.mode === 'solo' })}</p>
        <p className="mb-3 text-xs leading-relaxed text-kram-500">
          แป้นพิมพ์: แตะช่องเริ่มแล้วพิมพ์คำ (พิมพ์สระและวรรณยุกต์ตามได้เลย) Enter ลงคำ Backspace ย้อน Esc เก็บคืน
        </p>
        <h2 className="mb-2 font-display text-lg font-bold">ประวัติการเล่น</h2>
        <MoveLog history={game.history} names={names} me={me} />
      </aside>

      <PickerSheet ctl={ctl} />
      <ExchangeSheet open={sheet === 'exchange'} onClose={() => setSheet(null)} ctl={ctl} />
      <BagSheet open={sheet === 'bag'} onClose={() => setSheet(null)} game={game} me={me} />
      <RulesSheet open={sheet === 'rules'} onClose={() => setSheet(null)} settings={describeSettings(game.settings, { hints: setup.mode === 'solo' })} />
      <Sheet open={sheet === 'log'} onClose={() => setSheet(null)} title="ประวัติการเล่น">
        <MoveLog history={game.history} names={names} me={me} />
      </Sheet>

      <Sheet open={!!ctl.pendingOverwrite} onClose={ctl.cancelOverwrite} title="วางทับเบี้ยเดิม?">
        <p className="mb-5 text-[15px] text-kram-700">
          เบี้ย “{ctl.pendingOverwrite ? game.grid[ctl.pendingOverwrite.r][ctl.pendingOverwrite.c] : ''}” บนกระดานจะถูกแทนที่ วางทับได้ตาละ 1 ตัว
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={secondaryBtn} onClick={ctl.cancelOverwrite}>
            ไม่วาง
          </button>
          <button type="button" className={primaryBtn} onClick={ctl.confirmOverwrite}>
            วางทับ
          </button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'leave'} onClose={() => setSheet(null)} title={game.status === 'playing' ? 'ออกจากเกมนี้?' : 'กลับเมนู'}>
        <p className="mb-5 text-[15px] text-kram-700">
          {game.status !== 'playing'
            ? 'เกมนี้จบแล้ว'
            : setup.mode === 'solo'
              ? 'เกมจะถูกบันทึกไว้ กลับมาเล่นต่อได้จากเมนู'
              : 'ถ้าออกตอนนี้ คู่แข่งจะชนะเกมนี้'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {game.status === 'playing' && setup.mode === 'solo' ? (
            <button
              type="button"
              className={secondaryBtn}
              onClick={() => {
                setSheet(null);
                ctl.resign();
              }}
            >
              ยอมแพ้
            </button>
          ) : (
            <button type="button" className={secondaryBtn} onClick={() => setSheet(null)}>
              เล่นต่อ
            </button>
          )}
          <button type="button" className={primaryBtn} onClick={exit}>
            กลับเมนู
          </button>
        </div>
      </Sheet>

      <GameOver game={game} me={me} names={names} solo={setup.mode === 'solo'} onExit={onExit} onRematch={onRematch} />
    </main>
  );
}

function GameOver({
  game,
  me,
  names,
  solo,
  onExit,
  onRematch,
}: {
  game: GameState;
  me: PlayerId;
  names: Record<PlayerId, string>;
  solo: boolean;
  onExit: () => void;
  onRematch?: () => void;
}) {
  const [hidden, setHidden] = useState(false);
  const result = game.result;
  if (game.status !== 'over' || !result) return null;
  const other: PlayerId = me === 1 ? 2 : 1;
  const title = result.winner === 0 ? 'เสมอ' : result.winner === me ? 'คุณชนะ' : `${names[result.winner]} ชนะ`;
  const reason =
    result.reason === 'left'
      ? `${names[other]} ออกจากเกม`
      : result.reason === 'resign'
        ? `${names[result.winner === me ? other : me]} ยอมแพ้`
        : result.reason === 'out'
          ? 'เบี้ยในถุงหมดและมีคนลงเบี้ยหมดมือ'
          : 'ไม่มีใครลงคำได้ต่อ';
  const plays = game.history.filter((h) => h.kind === 'play');
  const best = plays.reduce<(typeof plays)[number] | null>((a, b) => (!a || b.score > a.score ? b : a), null);

  return (
    <Sheet open={!hidden} onClose={() => setHidden(true)} title={title}>
      <p className="mb-4 text-sm text-kram-500">{reason}</p>
      <div className="mb-4 grid grid-cols-2 gap-2">
        {[me, other].map((p) => (
          <div key={p} className={`rounded-xl p-4 ${result.winner === p ? 'bg-kram-900 text-ivory' : 'bg-kram-50 text-kram-900'}`}>
            <p className="truncate text-sm">{names[p]}</p>
            <p className="font-display text-4xl font-bold tabular-nums">{game.scores[p]}</p>
            {result.adjustments[p] + timePenalty(game, p) !== 0 && (
              <p className="text-xs opacity-75">
                {result.adjustments[p] + timePenalty(game, p) > 0 ? 'โบนัสเบี้ยหมดมือ +' : 'หักเบี้ยในมือ '}
                {result.adjustments[p] + timePenalty(game, p)}
              </p>
            )}
            {timePenalty(game, p) > 0 && <p className="text-xs opacity-75">ปรับเวลาเกิน −{timePenalty(game, p)}</p>}
          </div>
        ))}
      </div>
      {best && (
        <p className="mb-5 text-sm text-kram-700">
          ตาที่ดีที่สุด: <span className="font-display font-semibold">{(best.words ?? []).map((w) => w.text).join(', ')}</span> โดย{' '}
          {names[best.player]} +{best.score}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={secondaryBtn} onClick={onExit}>
          กลับเมนู
        </button>
        {solo && onRematch ? (
          <button type="button" className={primaryBtn} onClick={onRematch}>
            เล่นอีกเกม
          </button>
        ) : (
          <button type="button" className={primaryBtn} onClick={() => setHidden(true)}>
            ดูกระดาน
          </button>
        )}
      </div>
    </Sheet>
  );
}
