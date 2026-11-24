'use client';

// Game controller shared by solo and online play: holds the game state, the tiles the
// player is placing this turn (the draft), and every action the screen can trigger.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GRID_ROWS } from '@/lib/game/constants';
import { cloneGrid, isMainRow, markHost } from '@/lib/game/board';
import { evaluateMove, MoveEvaluation, Placement } from '@/lib/game/rules';
import {
  applyExchange,
  applyForfeit,
  applyPass,
  applyPlay,
  ActionResult,
  GameState,
  MoveRecord,
  otherPlayer,
  PlayerId,
  reorderRack,
} from '@/lib/game/state';
import { isBlankTile, shuffle, tileOptions, tileValue } from '@/lib/game/tiles';
import { isLowerContent, isLowerMark, isTopMark, isUpperVowel } from '@/lib/game/thai';
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
export type DraftMark = { kind: 'mark'; r: number; c: number; char: string; original: string | null };
export type Draft = DraftTile | DraftMark;

export type Picker =
  | { type: 'blank'; r: number; c: number; rackIndex: number; original: string | null }
  | { type: 'dual'; r: number; c: number; rackIndex: number; original: string | null; options: string[] }
  | { type: 'mark'; r: number; c: number };

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
  const [picker, setPicker] = useState<Picker | null>(null);
  const [pendingOverwrite, setPendingOverwrite] = useState<{ r: number; c: number; rackIndex: number } | null>(null);
  const [busy, setBusy] = useState<null | 'submit' | 'hint'>(null);

  const callbacks = useRef({ onChange, notify });
  useEffect(() => {
    callbacks.current = { onChange, notify };
  });

  const rack = game.racks[me];
  const isMyTurn = game.status === 'playing' && game.current === me;
  const botThinking = !!botLevel && game.status === 'playing' && game.current !== me;

  const usedIndexes = useMemo(
    () => new Set(draft.filter((d): d is DraftTile => d.kind === 'tile').map((d) => d.rackIndex)),
    [draft],
  );

  const displayGrid = useMemo(() => {
    const grid = cloneGrid(game.grid);
    for (const d of draft) grid[d.r][d.c] = d.char;
    return grid;
  }, [game.grid, draft]);

  const displayBlanks = useMemo(() => {
    const set = new Set(game.blanks);
    for (const d of draft) {
      if (d.kind !== 'tile') continue;
      if (d.isBlank) set.add(`${d.r},${d.c}`);
      else set.delete(`${d.r},${d.c}`);
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

  const evaluation: MoveEvaluation | null = useMemo(
    () =>
      draft.some((d) => d.kind === 'tile')
        ? evaluateMove(game.grid, new Set(game.blanks), placements, dictionary?.has)
        : null,
    [draft, game.grid, game.blanks, placements, dictionary],
  );

  const commit = useCallback((result: ActionResult & { ok: true }) => {
    setGame(result.state);
    setDraft([]);
    setSelected(null);
    setPicker(null);
    callbacks.current.onChange?.(result.state, result.record);
  }, []);

  // ---- Placing tiles ----------------------------------------------------------------

  const addTile = useCallback((tile: DraftTile) => {
    setDraft((list) => [...list.filter((d) => !(d.r === tile.r && d.c === tile.c)), tile]);
    setSelected(null);
  }, []);

  const placeFromRack = useCallback(
    (rackIndex: number, r: number, c: number, original: string | null) => {
      const tile = rack[rackIndex];
      const options = tileOptions(tile);
      if (isBlankTile(tile)) setPicker({ type: 'blank', r, c, rackIndex, original });
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
        const rest = list.filter((d) => d !== removed);
        if (removed.original) return rest;
        // Drop marks that were sitting on this letter.
        return rest.filter((d) => {
          if (d.kind !== 'mark') return true;
          const host = markHost(d.r, d.c, d.char);
          return !(host && host.r === r && host.c === c);
        });
      });
    },
    [],
  );

  const tapCell = useCallback(
    (r: number, c: number) => {
      if (game.status !== 'playing') return;
      if (!isMyTurn) {
        callbacks.current.notify({ title: 'ยังไม่ถึงตาของคุณ' });
        return;
      }
      if (busy) return;
      if (isMainRow(r)) {
        if (draft.some((d) => d.kind === 'tile' && d.r === r && d.c === c)) {
          removeTileAt(r, c);
          return;
        }
        if (selected === null) {
          if (!game.grid[r][c]) callbacks.current.notify({ title: 'แตะเบี้ยในมือก่อน แล้วแตะช่องที่จะวาง' });
          return;
        }
        if (game.grid[r][c]) {
          setPendingOverwrite({ r, c, rackIndex: selected });
          return;
        }
        placeFromRack(selected, r, c, null);
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
    [game.status, game.grid, isMyTurn, busy, draft, selected, displayGrid, placeFromRack, removeTileAt],
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

  /** What can go in a mark cell right now. Marks placed this turn can be swapped; marks already on the board stay. */
  const markSlot = useCallback(
    (r: number, c: number) => {
      const committed = game.grid[r][c];
      const draftMark = draft.find((d) => d.kind === 'mark' && d.r === r && d.c === c);
      const current = draftMark?.char ?? committed ?? '';
      return {
        current,
        committed,
        hasDraft: !!draftMark,
        canUpper: r + 1 < GRID_ROWS && !!displayGrid[r + 1][c] && !isLowerContent(committed),
        canLower: r - 1 >= 0 && !!displayGrid[r - 1][c] && !committed,
      };
    },
    [game.grid, draft, displayGrid],
  );

  const addMark = useCallback(
    (r: number, c: number, mark: string) => {
      const slot = markSlot(r, c);
      const fixed = [...(slot.committed ?? '')];
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

  const clearMark = useCallback((r: number, c: number) => {
    setDraft((list) => list.filter((d) => !(d.kind === 'mark' && d.r === r && d.c === c)));
  }, []);

  const selectRack = useCallback(
    (i: number) => {
      if (usedIndexes.has(i)) return;
      setSelected((s) => (s === i ? null : i));
    },
    [usedIndexes],
  );

  const recallAll = useCallback(() => {
    setDraft([]);
    setSelected(null);
  }, []);

  const shuffleRack = useCallback(() => {
    const free = rack.map((_, i) => i).filter((i) => !usedIndexes.has(i));
    const mixed = shuffle(free.map((i) => rack[i]));
    const next = [...rack];
    free.forEach((idx, k) => (next[idx] = mixed[k]));
    setGame((g) => reorderRack(g, me, next));
    setSelected(null);
  }, [rack, usedIndexes, me]);

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
      const result = applyPlay(game, me, placements, isWord);
      if (!result.ok) {
        callbacks.current.notify({ title: result.error, tone: 'error' });
        return;
      }
      commit(result);
      const bingo = result.record.bingo ? ` รวมโบนัสใช้เบี้ย ${result.record.tiles} ตัว +${result.record.bingo}` : '';
      callbacks.current.notify({ title: `ลงคำ ${wordsLabel(result.record.words)} +${result.record.score}`, body: bingo || undefined, tone: 'success' });
    } catch {
      callbacks.current.notify({ title: 'ตรวจคำไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง', tone: 'error' });
    } finally {
      submitting.current = false;
      setBusy(null);
    }
  }, [isMyTurn, busy, evaluation, dictionary, game, me, placements, commit]);

  const exchange = useCallback(
    (indexes: number[]) => {
      const result = applyExchange(game, me, indexes.map((i) => rack[i]));
      if (!result.ok) {
        callbacks.current.notify({ title: result.error, tone: 'error' });
        return false;
      }
      commit(result);
      callbacks.current.notify({ title: `แลกเบี้ย ${indexes.length} ตัวแล้ว` });
      return true;
    },
    [game, me, rack, commit],
  );

  const pass = useCallback(() => {
    const result = applyPass(game, me);
    if (!result.ok) return callbacks.current.notify({ title: result.error, tone: 'error' });
    commit(result);
  }, [game, me, commit]);

  const resign = useCallback(() => {
    const state = applyForfeit(game, me, 'resign');
    setGame(state);
    setDraft([]);
    callbacks.current.onChange?.(state, state.history.at(-1) ?? null);
  }, [game, me]);

  const hint = useCallback(async () => {
    if (!isMyTurn || busy) return;
    setBusy('hint');
    try {
      const moves = await findMoves(game.grid, game.blanks, rack);
      const best = moves[0];
      if (!best) {
        callbacks.current.notify({ title: 'ไม่พบคำที่ลงได้ในตานี้', body: 'ลองแลกเบี้ยหรือข้ามตา' });
        return;
      }
      setDraft(candidateToDraft(best, rack, game));
      setSelected(null);
      callbacks.current.notify({ title: `ลองคำ ${wordsLabel(best.words)} ได้ ${best.total} แต้ม`, body: 'กดลงคำได้เลย หรือแตะเบี้ยเพื่อเก็บคืน' });
    } finally {
      setBusy(null);
    }
  }, [isMyTurn, busy, game, rack]);

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
      setPicker(null);
    },
    [me],
  );

  /** Online: the other player left, so this player wins. */
  const opponentLeft = useCallback(() => {
    setGame((g) => applyForfeit(g, otherPlayer(me), 'left'));
    setDraft([]);
  }, [me]);

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
      let result: ActionResult | null = choice && dict ? applyPlay(game, botId, choice.placements, dict.has) : null;
      if (!result?.ok) {
        const n = Math.min(game.bag.length, botRack.length);
        const worst = [...botRack].sort((a, b) => tileValue(b) - tileValue(a)).slice(0, n);
        result = n > 0 ? applyExchange(game, botId, worst) : applyPass(game, botId);
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
  }, [botLevel, game, me, commit]);

  return {
    game,
    me,
    rack,
    draft,
    displayGrid,
    displayBlanks,
    usedIndexes,
    selected,
    picker,
    pendingOverwrite,
    evaluation,
    isMyTurn,
    botThinking,
    busy,
    tapCell,
    selectRack,
    pickLetter,
    closePicker: () => setPicker(null),
    markSlot,
    addMark,
    clearMark,
    confirmOverwrite,
    cancelOverwrite: () => setPendingOverwrite(null),
    recallAll,
    removeTileAt,
    shuffleRack,
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

function candidateToDraft(move: CandidateMove, rack: string[], game: GameState): Draft[] {
  const taken = new Set<number>();
  return move.placements.map((p) => {
    if (!isMainRow(p.r)) return { kind: 'mark', r: p.r, c: p.c, char: p.char, original: game.grid[p.r][p.c] };
    const rackIndex = rack.findIndex((t, i) => !taken.has(i) && t === p.rackTile);
    taken.add(rackIndex);
    return { kind: 'tile', r: p.r, c: p.c, char: p.char, isBlank: !!p.isBlank, rackIndex, original: game.grid[p.r][p.c] };
  });
}
