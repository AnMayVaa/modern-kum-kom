'use client';

import { useEffect, useRef, useState } from 'react';
import type { MoveEvaluation } from '@/lib/game/rules';
import type { GameState, MoveRecord, PlayerId } from '@/lib/game/state';
import { RackTileFace } from '@/components/ui/Tile';

/**
 * The player's nine tiles. Tap a tile to pick it (or, with a typing cursor on the board,
 * to put it there). Drag a tile onto the board to place it, or onto another slot to reorder.
 */
export function Rack({
  rack,
  used,
  selected,
  onSelect,
  onMove,
  onDropToBoard,
}: {
  rack: string[];
  used: Set<number>;
  selected: number | null;
  onSelect: (i: number) => void;
  onMove: (from: number, to: number) => void;
  onDropToBoard: (i: number, r: number, c: number) => void;
}) {
  const [ghost, setGhost] = useState<{ index: number; x: number; y: number } | null>(null);
  const press = useRef<{ index: number; x: number; y: number; id: number; moved: boolean } | null>(null);
  const hovered = useRef<HTMLElement | null>(null);
  const swallowClick = useRef(false);

  const mark = (el: HTMLElement | null) => {
    if (hovered.current === el) return;
    hovered.current?.removeAttribute('data-drop');
    el?.setAttribute('data-drop', 'true');
    hovered.current = el;
  };
  const targetAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    return { cell: el?.closest<HTMLElement>('[data-cell]') ?? null, slot: el?.closest<HTMLElement>('[data-slot]') ?? null };
  };

  useEffect(() => () => hovered.current?.removeAttribute('data-drop'), []);

  return (
    <>
      <div
        className="flex justify-center gap-[min(0.4rem,1.2vw)]"
        style={{ ['--t' as string]: 'min(3.4rem, calc((100vw - 2.5rem) / 9.8))' }}
        role="group"
        aria-label="เบี้ยในมือ"
      >
        {rack.map((tile, i) =>
          used.has(i) ? (
            <span key={i} data-slot={i} className="block h-[var(--t)] w-[var(--t)] rounded-[14%] bg-kram-200/70" aria-hidden />
          ) : (
            <button
              key={i}
              type="button"
              data-slot={i}
              aria-pressed={selected === i}
              aria-label={tile === '0' ? 'เบี้ยว่าง' : tile}
              className={`tile h-[var(--t)] w-[var(--t)] touch-none text-[calc(var(--t)*0.6)] transition-transform ${
                selected === i ? '-translate-y-2 ring-[3px] ring-gold' : 'hover:-translate-y-0.5'
              } ${ghost?.index === i ? 'opacity-30' : ''}`}
              onClick={() => {
                if (swallowClick.current) {
                  swallowClick.current = false;
                  return;
                }
                onSelect(i);
              }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                press.current = { index: i, x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                const p = press.current;
                if (!p || p.id !== e.pointerId) return;
                if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 8) return;
                p.moved = true;
                setGhost({ index: p.index, x: e.clientX, y: e.clientY });
                const { cell, slot } = targetAt(e.clientX, e.clientY);
                mark(cell ?? slot);
              }}
              onPointerUp={(e) => {
                const p = press.current;
                press.current = null;
                if (!p || !p.moved) return;
                swallowClick.current = true;
                setTimeout(() => (swallowClick.current = false), 0);
                setGhost(null);
                mark(null);
                const { cell, slot } = targetAt(e.clientX, e.clientY);
                if (cell) onDropToBoard(p.index, Number(cell.dataset.r), Number(cell.dataset.c));
                else if (slot) onMove(p.index, Number(slot.dataset.slot));
              }}
              onPointerCancel={() => {
                press.current = null;
                setGhost(null);
                mark(null);
              }}
            >
              <RackTileFace tile={tile} />
            </button>
          ),
        )}
      </div>
      {ghost && rack[ghost.index] !== undefined && (
        <span
          className="tile drag-ghost h-[var(--t)] w-[var(--t)] text-[calc(var(--t)*0.6)]"
          style={{ left: ghost.x, top: ghost.y, ['--t' as string]: 'min(3.4rem, calc((100vw - 2.5rem) / 9.8))' }}
          aria-hidden
        >
          <RackTileFace tile={rack[ghost.index]} />
        </span>
      )}
    </>
  );
}

// ---- Clocks ---------------------------------------------------------------------------------

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

const fmt = (ms: number) => {
  const neg = ms < 0;
  const total = Math.ceil(Math.abs(ms) / 1000);
  return `${neg ? '−' : ''}${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/** Time left for a player, or null when there is no clock to show. */
function timeLeft(game: GameState, p: PlayerId, now: number, turnStart: number): number | null {
  const { timer } = game.settings;
  const running = game.status === 'playing' && game.current === p;
  if (timer.kind === 'game') return timer.minutes * 60_000 - game.clock[p] - (running ? now - turnStart : 0);
  if (timer.kind === 'turn') return running ? timer.seconds * 1000 - (now - turnStart) : null;
  return null;
}

export function ScoreBar({
  game,
  me,
  names,
  turnStart,
  onBag,
}: {
  game: GameState;
  me: PlayerId;
  names: Record<PlayerId, string>;
  turnStart: number;
  onBag: () => void;
}) {
  const order: PlayerId[] = [me, me === 1 ? 2 : 1];
  const now = useNow(game.settings.timer.kind !== 'off' && game.status === 'playing');
  return (
    <div className="flex items-stretch gap-2">
      {order.map((p) => {
        const active = game.status === 'playing' && game.current === p;
        const left = timeLeft(game, p, now, turnStart);
        const low = left !== null && left < 20_000;
        return (
          <div
            key={p}
            className={`relative flex min-w-0 flex-1 items-center justify-between gap-2 overflow-hidden rounded-xl px-3 py-2 ${
              active ? 'bg-kram-900 text-ivory' : 'bg-white text-kram-900'
            }`}
            aria-current={active ? 'true' : undefined}
          >
            {active && <span className="absolute inset-y-0 left-0 w-1 bg-gold" aria-hidden />}
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium leading-tight">
                {names[p]}
                {p === me && <span className="opacity-60"> (คุณ)</span>}
              </p>
              <p className={`text-[11px] leading-tight tabular-nums ${low ? 'font-semibold text-chad' : active ? 'text-gold-soft' : 'text-kram-500'}`}>
                {left !== null ? (left < 0 ? `เกินเวลา ${fmt(left)}` : `เหลือ ${fmt(left)}`) : active ? (p === me ? 'ตาของคุณ' : 'กำลังเล่น') : `${game.racks[p].length} เบี้ยในมือ`}
              </p>
            </div>
            <span className="font-display text-2xl font-bold tabular-nums leading-none">{game.scores[p]}</span>
          </div>
        );
      })}
      <button
        type="button"
        onClick={onBag}
        className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-white text-kram-900 hover:bg-kram-50"
        aria-label={`เบี้ยในถุงเหลือ ${game.bag.length} ตัว ดูเบี้ยที่ยังไม่ออก`}
      >
        <span className="font-display text-xl font-bold leading-none tabular-nums">{game.bag.length}</span>
        <span className="text-[11px] text-kram-500">ในถุง</span>
      </button>
    </div>
  );
}

/** Live feedback for the tiles being placed: the words formed, whether they are real words, and the score. */
export function MovePreview({
  evaluation,
  status,
  dictionaryReady,
  strict,
}: {
  evaluation: MoveEvaluation | null;
  status: string;
  dictionaryReady: boolean;
  strict: boolean;
}) {
  if (!evaluation) {
    return <p className="min-h-[2.75rem] py-2 text-center text-sm text-kram-500">{status}</p>;
  }
  if (evaluation.error) {
    return <p className="min-h-[2.75rem] py-2 text-center text-sm font-medium text-chad">{evaluation.error}</p>;
  }
  return (
    <div className="flex min-h-[2.75rem] flex-wrap items-center justify-center gap-1.5 py-1.5" aria-live="polite">
      {evaluation.words.map((w) => (
        <span
          key={`${w.dir}${w.cells[0].r},${w.cells[0].c}`}
          title={w.detail}
          className={`inline-flex items-baseline gap-1.5 rounded-lg px-2.5 py-1 text-[15px] ring-1 ${
            w.valid === false ? 'bg-chad/10 text-chad ring-chad/30 line-through decoration-1' : 'bg-white text-kram-950 ring-kram-200'
          }`}
        >
          <span className="font-display font-semibold">{w.text}</span>
          <span className="text-xs tabular-nums text-kram-500">{w.score}</span>
        </span>
      ))}
      {evaluation.bingo > 0 && (
        <span className="rounded-lg bg-gold-soft px-2.5 py-1 text-[13px] font-medium text-kram-950">
          ใช้ {evaluation.tilesPlaced} ตัว +{evaluation.bingo}
        </span>
      )}
      {strict ? (
        <span className="text-xs text-kram-500">แบบแข่งขัน: ระบบไม่บอกล่วงหน้าว่าคำถูกไหม</span>
      ) : (
        !dictionaryReady && <span className="text-xs text-kram-500">(จะตรวจคำตอนกดลงคำ)</span>
      )}
    </div>
  );
}

export function MoveLog({ history, names, me }: { history: MoveRecord[]; names: Record<PlayerId, string>; me: PlayerId }) {
  if (history.length === 0) return <p className="text-sm text-kram-500">ยังไม่มีการลงคำ</p>;
  return (
    <ol className="flex flex-col divide-y divide-kram-100" reversed>
      {[...history].reverse().map((h) => (
        <li key={`${h.n}-${h.kind}`} className="flex items-baseline justify-between gap-3 py-2 text-sm">
          <span className="min-w-0">
            <span className={`mr-1.5 font-medium ${h.player === me ? 'text-kram-900' : 'text-kram-500'}`}>
              {h.kind === 'reset' ? 'กระดาน' : names[h.player]}
            </span>
            <span className={`font-display ${h.kind === 'invalid' ? 'text-chad' : ''}`}>
              {h.kind === 'play'
                ? (h.words ?? []).map((w) => w.text).join(', ')
                : h.kind === 'exchange'
                  ? `แลกเบี้ย ${h.tiles} ตัว`
                  : h.kind === 'pass'
                    ? h.note === 'หมดเวลา'
                      ? 'หมดเวลา ข้ามตา'
                      : 'ข้ามตา'
                    : h.note}
            </span>
          </span>
          {(h.kind === 'play' || (h.kind === 'finish' && h.score !== 0)) && (
            <span className="shrink-0 tabular-nums font-semibold text-kram-900">+{h.score}</span>
          )}
        </li>
      ))}
    </ol>
  );
}
