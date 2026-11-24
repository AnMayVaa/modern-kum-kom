'use client';

// Game controller shared by solo and online play: holds the game state, the tiles the
// player is placing this turn (the draft), the typing cursor, the clocks, and every action
// the screen can trigger.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BOARD_COLS, GRID_ROWS, MIN_BAG_TO_EXCHANGE } from '@/lib/game/constants';
import { cellKey, cloneGrid, isMainRow, markHost } from '@/lib/game/board';
import { evaluateMove, MoveEvaluation, Placement } from '@/lib/game/rules';
import {
  addTime,
  applyExchange,
  applyForfeit,
  applyInvalidPlay,
  applyPass,
  applyPlay,
  ActionResult,
  GameState,
  hintsLeft,
  MoveRecord,
  otherPlayer,
  PlayerId,
  spendHint,
} from '@/lib/game/state';
import { isBlankTile, isDualTile, shuffle, tileOptions, tileValue } from '@/lib/game/tiles';
import { isLowerContent, isLowerMark, isMainChar, isMark, isTopMark, isUpperVowel } from '@/lib/game/thai';
import { BotLevel, CandidateMove, pickMove } from '@/lib/game/bot';
import type { Dictionary } from '@/lib/game/dictionary';
import { checkWordsOnServer, findMoves, getLoadedDictionary } from '@/lib/client/dictionary';

export type DraftTile = {
  kind: 'tile';
  r: number;
  c: number;
  char: string;
  isBlank: boolean;
  rackIndex: number;
  original: string | null;
};
/** A mark cell's new content; '' takes off the marks of a letter that is being replaced. */
export type DraftMark = { kind: 'mark'; r: number; c: number; char: string; original: string | null };
export type Draft = DraftTile | DraftMark;

export type Picker =
  | { type: 'blank'; r: number; c: number; rackIndex: number; original: string | null }
  | { type: 'dual'; r: number; c: number; rackIndex: number; original: string | null; options: string[] }
  | { type: 'mark'; r: number; c: number };

export interface Cursor {
  r: number;
  c: number;
  dir: 'h' | 'v';
}

export interface Notice {
  title: string;
  body?: string;
  tone?: 'info' | 'success' | 'error';
}

interface Options {
  me: PlayerId;
  initial: GameState;
  dictionary: Dictionary | null;
  /** Solo mode: the other player is the bot. */
  botLevel?: BotLevel | null;
  /** Called with every state produced on this device (by the player or the bot). */
  onChange?: (state: GameState, record: MoveRecord | null) => void;
  notify: (notice: Notice) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const wordsLabel = (words: { text: string }[] = []) => words.map((w) => `“${w.text}”`).join(' ');

export function useGame({ me, initial, dictionary, botLevel = null, onChange, notify }: Options) {
  const [game, setGame] = useState(initial);
  const [draft, setDraft] = useState<Draft[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [pendingOverwrite, setPendingOverwrite] = useState<{ r: number; c: number; rackIndex: number } | null>(null);
  const [busy, setBusy] = useState<null | 'submit' | 'hint'>(null);
  /** When the current turn started on this device, for the clocks. */
  const [turnStart, setTurnStart] = useState(() => Date.now());

  const callbacks = useRef({ onChange, notify });
  const latest = useRef({ game, turnStart, draft });
  useEffect(() => {
    callbacks.current = { onChange, notify };
    latest.current = { game, turnStart, draft };
  });

  const rack = game.racks[me];
  const strict = game.settings.strict;
  const isMyTurn = game.status === 'playing' && game.current === me;
  const botThinking = !!botLevel && game.status === 'playing' && game.current !== me;

  const usedIndexes = useMemo(
    () => new Set(draft.filter((d): d is DraftTile => d.kind === 'tile').map((d) => d.rackIndex)),
    [draft],
  );

  const displayGrid = useMemo(() => {
    const grid = cloneGrid(game.grid);
    for (const d of draft) grid[d.r][d.c] = d.char || null;
    return grid;
  }, [game.grid, draft]);

  const displayBlanks = useMemo(() => {
    const set = new Set(game.blanks);
    for (const d of draft) {
      if (d.kind !== 'tile') continue;
      if (d.isBlank) set.add(cellKey(d.r, d.c));
      else set.delete(cellKey(d.r, d.c));
    }
    return set;
  }, [game.blanks, draft]);

  const placements = useMemo<Placement[]>(
    () =>
      draft.map((d) =>
        d.kind === 'tile'
          ? { r: d.r, c: d.c, char: d.char, isBlank: d.isBlank, rackTile: rack[d.rackIndex] }
          : { r: d.r, c: d.c, char: d.char },
      ),
    [draft, rack],
  );

  // In tournament mode the preview shows the words and the score, not whether they are real.
  const evaluation: MoveEvaluation | null = useMemo(
    () =>
      draft.some((d) => d.kind === 'tile')
        ? evaluateMove(game.grid, new Set(game.blanks), placements, strict ? undefined : dictionary?.has)
        : null,
    [draft, game.grid, game.blanks, placements, dictionary, strict],
  );

  const commit = useCallback((result: ActionResult & { ok: true }) => {
    setGame(result.state);
    setDraft([]);
    setSelected(null);
    setCursor(null);
    setPicker(null);
    setTurnStart(Date.now());
    callbacks.current.onChange?.(result.state, result.record);
  }, []);

  /** The game with this player's thinking time for the current turn added. */
  const timed = useCallback((player: PlayerId) => {
    const { game: g, turnStart: t } = latest.current;
    return addTime(g, player, Date.now() - t);
  }, []);

  // ---- Placing tiles ----------------------------------------------------------------

  /** The next empty letter square after (r, c) in a direction, or null at the edge. */
  const nextEmpty = useCallback(
    (from: Cursor, grid = displayGrid): Cursor | null => {
      let { r, c } = from;
      for (;;) {
        if (from.dir === 'h') c += 1;
        else r += 2;
        if (c >= BOARD_COLS || r >= GRID_ROWS) return null;
        if (!grid[r][c]) return { r, c, dir: from.dir };
      }
    },
    [displayGrid],
  );

  const addTile = useCallback(
    (tile: DraftTile) => {
      setDraft((list) => [...list.filter((d) => !(d.r === tile.r && d.c === tile.c)), tile]);
      setSelected(null);
      // Keep typing along the same line.
      setCursor((cur) => {
        if (!cur || cur.r !== tile.r || cur.c !== tile.c) return cur;
        const grid = cloneGrid(displayGrid);
        grid[tile.r][tile.c] = tile.char;
        return nextEmpty(cur, grid);
      });
    },
    [displayGrid, nextEmpty],
  );

  const placeFromRack = useCallback(
    (rackIndex: number, r: number, c: number, original: string | null, letter?: string) => {
      const tile = rack[rackIndex];
      if (tile === undefined) return;
      const options = tileOptions(tile);
      if (letter) addTile({ kind: 'tile', r, c, char: letter, isBlank: isBlankTile(tile), rackIndex, original });
      else if (isBlankTile(tile)) setPicker({ type: 'blank', r, c, rackIndex, original });
      else if (options.length > 1) setPicker({ type: 'dual', r, c, rackIndex, original, options });
      else addTile({ kind: 'tile', r, c, char: tile, isBlank: false, rackIndex, original });
      setSelected(null);
    },
    [rack, addTile],
  );

  const removeTileAt = useCallback(
    (r: number, c: number) => {
      setDraft((list) => {
        const removed = list.find((d) => d.kind === 'tile' && d.r === r && d.c === c);
        if (!removed) return list;
        // Marks added to (or taken off) this letter go with it.
        return list.filter((d) => {
          if (d === removed) return false;
          if (d.kind !== 'mark') return true;
          const content = d.char || game.grid[d.r][d.c] || '';
          const host = content ? markHost(d.r, d.c, content) : null;
          return !(host && host.r === r && host.c === c);
        });
      });
    },
    [game.grid],
  );

  const canAct = useCallback(() => {
    if (game.status !== 'playing') return false;
    if (!isMyTurn) {
      callbacks.current.notify({ title: 'ยังไม่ถึงตาของคุณ' });
      return false;
    }
    return !busy;
  }, [game.status, isMyTurn, busy]);

  const tapCell = useCallback(
    (r: number, c: number) => {
      if (!canAct()) return;
      if (isMainRow(r)) {
        if (draft.some((d) => d.kind === 'tile' && d.r === r && d.c === c)) {
          removeTileAt(r, c);
          return;
        }
        if (selected !== null) {
          if (game.grid[r][c]) setPendingOverwrite({ r, c, rackIndex: selected });
          else placeFromRack(selected, r, c, null);
          return;
        }
        if (game.grid[r][c]) return;
        // No tile picked: put the typing cursor here (tap again to switch direction).
        setCursor((cur) => (cur && cur.r === r && cur.c === c ? { r, c, dir: cur.dir === 'h' ? 'v' : 'h' } : { r, c, dir: 'h' }));
        return;
      }
      const hasAbove = r - 1 >= 0 && !!displayGrid[r - 1][c];
      const hasBelow = r + 1 < GRID_ROWS && !!displayGrid[r + 1][c];
      if (!hasAbove && !hasBelow) {
        callbacks.current.notify({ title: 'วางสระและวรรณยุกต์ได้เฉพาะบนหรือใต้ตัวอักษร' });
        return;
      }
      setPicker({ type: 'mark', r, c });
    },
    [canAct, game.grid, draft, selected, displayGrid, placeFromRack, removeTileAt],
  );

  /** Drag and drop from the rack onto a square. */
  const dropTile = useCallback(
    (rackIndex: number, r: number, c: number) => {
      if (!canAct() || !isMainRow(r) || usedIndexes.has(rackIndex)) return;
      if (draft.some((d) => d.kind === 'tile' && d.r === r && d.c === c)) return;
      if (game.grid[r][c]) setPendingOverwrite({ r, c, rackIndex });
      else placeFromRack(rackIndex, r, c, null);
    },
    [canAct, usedIndexes, draft, game.grid, placeFromRack],
  );

  const confirmOverwrite = useCallback(() => {
    if (!pendingOverwrite) return;
    const { r, c, rackIndex } = pendingOverwrite;
    setPendingOverwrite(null);
    placeFromRack(rackIndex, r, c, game.grid[r][c]);
  }, [pendingOverwrite, placeFromRack, game.grid]);

  const pickLetter = useCallback(
    (letter: string) => {
      if (!picker || picker.type === 'mark') return;
      addTile({
        kind: 'tile',
        r: picker.r,
        c: picker.c,
        char: letter,
        isBlank: picker.type === 'blank',
        rackIndex: picker.rackIndex,
        original: picker.original,
      });
      setPicker(null);
    },
    [picker, addTile],
  );

  /** What can go in a mark cell right now. */
  const markSlot = useCallback(
    (r: number, c: number) => {
      const committed = game.grid[r][c];
      const draftMark = draft.find((d) => d.kind === 'mark' && d.r === r && d.c === c);
      const current = draftMark ? draftMark.char : (committed ?? '');
      // The marks of a letter being replaced this turn may be changed or taken off.
      const owner = committed ? markHost(r, c, committed) : null;
      const replaceable =
        !!owner && draft.some((d) => d.kind === 'tile' && d.original && d.r === owner.r && d.c === owner.c);
      const fixed = replaceable ? '' : (committed ?? '');
      return {
        current,
        committed,
        fixed,
        replaceable,
        hasDraft: !!draftMark,
        canUpper: r + 1 < GRID_ROWS && !!displayGrid[r + 1][c] && !isLowerContent(fixed),
        canLower: r - 1 >= 0 && !!displayGrid[r - 1][c] && !fixed,
      };
    },
    [game.grid, draft, displayGrid],
  );

  const addMark = useCallback(
    (r: number, c: number, mark: string) => {
      const slot = markSlot(r, c);
      const fixed = [...slot.fixed];
      const now = isLowerContent(slot.current) ? [] : [...slot.current];
      const vowel = now.find(isUpperVowel) ?? '';
      const top = now.find(isTopMark) ?? '';
      let next: string | null = null;
      if (isLowerMark(mark)) next = slot.canLower ? mark : null;
      else if (slot.canUpper && isUpperVowel(mark)) next = fixed.some(isUpperVowel) ? null : mark + top;
      else if (slot.canUpper && isTopMark(mark)) next = fixed.some(isTopMark) ? null : vowel + mark;
      if (!next) {
        callbacks.current.notify({ title: 'ใส่เครื่องหมายนี้ในช่องนี้ไม่ได้', tone: 'error' });
        return false;
      }
      setDraft((list) => [
        ...list.filter((d) => !(d.kind === 'mark' && d.r === r && d.c === c)),
        { kind: 'mark', r, c, char: next, original: slot.committed },
      ]);
      return true;
    },
    [markSlot],
  );

  /** Undo this turn's change to a mark cell. */
  const clearMark = useCallback((r: number, c: number) => {
    setDraft((list) => list.filter((d) => !(d.kind === 'mark' && d.r === r && d.c === c)));
  }, []);

  /** Take off the marks of a letter that is being replaced. */
  const removeMarks = useCallback(
    (r: number, c: number) => {
      if (!markSlot(r, c).replaceable) return;
      setDraft((list) => [
        ...list.filter((d) => !(d.kind === 'mark' && d.r === r && d.c === c)),
        { kind: 'mark', r, c, char: '', original: game.grid[r][c] },
      ]);
    },
    [markSlot, game.grid],
  );

  const selectRack = useCallback(
    (i: number) => {
      if (usedIndexes.has(i)) return;
      // With a typing cursor on the board, tapping a tile puts it there straight away.
      if (cursor && isMyTurn && !busy && !displayGrid[cursor.r][cursor.c]) {
        placeFromRack(i, cursor.r, cursor.c, null);
        return;
      }
      setSelected((s) => (s === i ? null : i));
    },
    [usedIndexes, cursor, isMyTurn, busy, displayGrid, placeFromRack],
  );

  /** Puts the rack in a new order; `order` lists old positions in their new order. */
  const reorder = useCallback(
    (order: number[]) => {
      const next = order.map((i) => rack[i]);
      setGame((g) => ({ ...g, racks: { ...g.racks, [me]: next } as Record<PlayerId, string[]> }));
      setDraft((list) => list.map((d) => (d.kind === 'tile' ? { ...d, rackIndex: order.indexOf(d.rackIndex) } : d)));
      setSelected((s) => (s === null ? null : order.indexOf(s)));
      setPicker((p) => (p && p.type !== 'mark' ? { ...p, rackIndex: order.indexOf(p.rackIndex) } : p));
    },
    [rack, me],
  );

  /** Drag a rack tile to another slot. */
  const moveRackTile = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      const order = rack.map((_, i) => i);
      order.splice(to, 0, order.splice(from, 1)[0]);
      reorder(order);
    },
    [rack, reorder],
  );

  const shuffleRack = useCallback(() => reorder(shuffle(rack.map((_, i) => i))), [rack, reorder]);

  const recallAll = useCallback(() => {
    setDraft([]);
    setSelected(null);
  }, []);

  // ---- Typing (computer keyboard) -------------------------------------------------------

  /** Places the rack tile for a typed letter at the cursor. */
  const typeLetter = useCallback(
    (letter: string) => {
      if (!cursor || !isMyTurn || busy || displayGrid[cursor.r][cursor.c]) return false;
      const free = rack.map((t, i) => ({ t, i })).filter(({ i }) => !usedIndexes.has(i));
      const hit =
        free.find(({ t }) => t === letter) ??
        free.find(({ t }) => isDualTile(t) && tileOptions(t).includes(letter)) ??
        free.find(({ t }) => isBlankTile(t));
      if (!hit) {
        callbacks.current.notify({ title: `ไม่มี “${letter}” ในมือ`, tone: 'error' });
        return false;
      }
      placeFromRack(hit.i, cursor.r, cursor.c, null, letter);
      return true;
    },
    [cursor, isMyTurn, busy, displayGrid, rack, usedIndexes, placeFromRack],
  );

  /** Adds a typed vowel or tone mark to the letter placed last. */
  const typeMark = useCallback(
    (mark: string) => {
      const last = [...draft].reverse().find((d): d is DraftTile => d.kind === 'tile');
      if (!last) return false;
      // ต่ำ: a tone typed after ำ goes above the ำ tile, which is where it already is.
      return addMark(isLowerMark(mark) ? last.r + 1 : last.r - 1, last.c, mark);
    },
    [draft, addMark],
  );

  const undoLast = useCallback(() => {
    const last = draft.at(-1);
    if (!last) return;
    if (last.kind === 'tile') {
      removeTileAt(last.r, last.c);
      setCursor((cur) => ({ r: last.r, c: last.c, dir: cur?.dir ?? 'h' }));
    } else clearMark(last.r, last.c);
  }, [draft, removeTileAt, clearMark]);

  // ---- Turn actions -----------------------------------------------------------------

  const submitting = useRef(false);
  const submit = useCallback(async () => {
    if (!isMyTurn || busy || !evaluation || submitting.current) return;
    if (evaluation.error) {
      callbacks.current.notify({ title: evaluation.error, tone: 'error' });
      return;
    }
    submitting.current = true;
    setBusy('submit');
    try {
      let isWord = dictionary?.has;
      if (!isWord) {
        const results = await checkWordsOnServer(evaluation.words.map((w) => w.text));
        isWord = (w: string) => results[w] === true;
      }
      const invalid = evaluation.words.filter((w) => !isWord!(w.text)).map((w) => w.text);
      const state = timed(me);
      if (invalid.length && strict) {
        const lost = applyInvalidPlay(state, me, invalid);
        if (lost.ok) {
          commit(lost);
          callbacks.current.notify({ title: `ไม่มีคำว่า ${invalid.map((w) => `“${w}”`).join(' ')}`, body: 'ตามกติกาแข่งขัน เสียตานี้และได้ 0 แต้ม', tone: 'error' });
        }
        return;
      }
      const result = applyPlay(state, me, placements, isWord);
      if (!result.ok) {
        callbacks.current.notify({ title: result.error, tone: 'error' });
        return;
      }
      commit(result);
      const bingo = result.record.bingo ? `ลงเบี้ย ${result.record.tiles} ตัว ได้โบนัส +${result.record.bingo}` : undefined;
      callbacks.current.notify({ title: `ลงคำ ${wordsLabel(result.record.words)} +${result.record.score}`, body: bingo, tone: 'success' });
    } catch {
      callbacks.current.notify({ title: 'ตรวจคำไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง', tone: 'error' });
    } finally {
      submitting.current = false;
      setBusy(null);
    }
  }, [isMyTurn, busy, evaluation, dictionary, me, placements, commit, strict, timed]);

  const exchange = useCallback(
    (indexes: number[]) => {
      const result = applyExchange(timed(me), me, indexes.map((i) => rack[i]));
      if (!result.ok) {
        callbacks.current.notify({ title: result.error, tone: 'error' });
        return false;
      }
      commit(result);
      callbacks.current.notify({ title: `แลกเบี้ย ${indexes.length} ตัวแล้ว` });
      return true;
    },
    [me, rack, commit, timed],
  );

  const pass = useCallback(() => {
    const result = applyPass(timed(me), me);
    if (!result.ok) return callbacks.current.notify({ title: result.error, tone: 'error' });
    commit(result);
  }, [me, commit, timed]);

  const resign = useCallback(() => {
    const state = applyForfeit(game, me, 'resign');
    setGame(state);
    setDraft([]);
    callbacks.current.onChange?.(state, state.history.at(-1) ?? null);
  }, [game, me]);

  const hints = hintsLeft(game, me);
  const hint = useCallback(async () => {
    if (!isMyTurn || busy || hints === 0) return;
    setBusy('hint');
    try {
      const moves = await findMoves(game.grid, game.blanks, rack);
      const best = moves[0];
      if (!best) {
        callbacks.current.notify({ title: 'ไม่พบคำที่ลงได้ในตานี้', body: 'ลองแลกเบี้ยหรือข้ามตา' });
        return;
      }
      setGame((g) => spendHint(g, me));
      setDraft(candidateToDraft(best, rack, game));
      setSelected(null);
      setCursor(null);
      callbacks.current.notify({ title: `ลองคำ ${wordsLabel(best.words)} ได้ ${best.total} แต้ม`, body: 'กดลงคำได้เลย หรือแตะเบี้ยเพื่อเก็บคืน' });
    } finally {
      setBusy(null);
    }
  }, [isMyTurn, busy, hints, game, rack, me]);

  /** Online: take a newer state from the other player. */
  const receive = useCallback(
    (incoming: GameState) => {
      setGame((prev) => {
        if (incoming.version <= prev.version) return prev;
        const mine = prev.racks[me];
        const sameTiles = [...mine].sort().join() === [...incoming.racks[me]].sort().join();
        return sameTiles ? { ...incoming, racks: { ...incoming.racks, [me]: mine } } : incoming;
      });
      setDraft([]);
      setSelected(null);
      setCursor(null);
      setPicker(null);
      setTurnStart(Date.now());
    },
    [me],
  );

  /** Online: the other player left, so this player wins. */
  const opponentLeft = useCallback(() => {
    setGame((g) => applyForfeit(g, otherPlayer(me), 'left'));
    setDraft([]);
  }, [me]);

  // ---- Per-turn time limit: the turn passes when time runs out ------------------------------

  const { timer } = game.settings;
  useEffect(() => {
    if (timer.kind !== 'turn' || !isMyTurn) return;
    const left = timer.seconds * 1000 - (Date.now() - turnStart);
    const id = setTimeout(() => {
      const result = applyPass(timed(me), me, 'หมดเวลา');
      if (result.ok) {
        commit(result);
        callbacks.current.notify({ title: 'หมดเวลา ข้ามตาให้อัตโนมัติ', tone: 'error' });
      }
    }, Math.max(0, left));
    return () => clearTimeout(id);
  }, [timer, isMyTurn, turnStart, me, commit, timed]);

  // ---- The bot (solo mode) ------------------------------------------------------------

  useEffect(() => {
    if (!botLevel || game.status !== 'playing' || game.current === me) return;
    let cancelled = false;
    const botId = otherPlayer(me);
    const started = Date.now();
    (async () => {
      const botRack = game.racks[botId];
      const moves = await findMoves(game.grid, game.blanks, botRack).catch(() => [] as CandidateMove[]);
      await sleep(Math.max(0, 900 - (Date.now() - started)));
      if (cancelled) return;
      const dict = getLoadedDictionary();
      const choice = pickMove(moves, botLevel);
      const state = timed(botId);
      let result: ActionResult | null = choice && dict ? applyPlay(state, botId, choice.placements, dict.has) : null;
      if (!result?.ok) {
        const worst = [...botRack].sort((a, b) => tileValue(b) - tileValue(a)).slice(0, 5);
        result = state.bag.length >= MIN_BAG_TO_EXCHANGE ? applyExchange(state, botId, worst) : applyPass(state, botId);
      }
      if (cancelled || !result.ok) return;
      commit(result);
      const rec = result.record;
      callbacks.current.notify(
        rec.kind === 'play'
          ? { title: `บอทลงคำ ${wordsLabel(rec.words)} +${rec.score}` }
          : rec.kind === 'exchange'
            ? { title: `บอทแลกเบี้ย ${rec.tiles} ตัว` }
            : { title: 'บอทข้ามตา' },
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [botLevel, game, me, commit, timed]);

  return {
    game,
    me,
    rack,
    draft,
    displayGrid,
    displayBlanks,
    usedIndexes,
    selected,
    cursor,
    picker,
    pendingOverwrite,
    evaluation,
    isMyTurn,
    botThinking,
    busy,
    hints,
    turnStart,
    tapCell,
    dropTile,
    selectRack,
    moveRackTile,
    pickLetter,
    closePicker: () => setPicker(null),
    clearCursor: () => setCursor(null),
    markSlot,
    addMark,
    clearMark,
    removeMarks,
    confirmOverwrite,
    cancelOverwrite: () => setPendingOverwrite(null),
    recallAll,
    removeTileAt,
    shuffleRack,
    typeLetter,
    typeMark,
    undoLast,
    submit,
    exchange,
    pass,
    resign,
    hint,
    receive,
    opponentLeft,
  };
}

export type GameController = ReturnType<typeof useGame>;

export const isTypedLetter = isMainChar;
export const isTypedMark = isMark;

function candidateToDraft(move: CandidateMove, rack: string[], game: GameState): Draft[] {
  const taken = new Set<number>();
  return move.placements.map((p) => {
    if (!isMainRow(p.r)) return { kind: 'mark', r: p.r, c: p.c, char: p.char, original: game.grid[p.r][p.c] };
    const rackIndex = rack.findIndex((t, i) => !taken.has(i) && t === p.rackTile);
    taken.add(rackIndex);
    return { kind: 'tile', r: p.r, c: p.c, char: p.char, isBlank: !!p.isBlank, rackIndex, original: game.grid[p.r][p.c] };
  });
}
