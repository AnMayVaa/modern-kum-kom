// Whole-game state and the actions that move it forward. Every action is a pure
// function: (state, input) -> new state, so solo play, online play and the tests all
// run exactly the same rules.

import { RACK_SIZE, STALEMATE_LIMIT } from './constants';
import { cellKey, createGrid, fromSparse, Grid, isMainRow, SparseGrid, toSparse } from './board';
import { evaluateMove, MoveEvaluation, Placement, WordCheck } from './rules';
import { createBag, rackValue, removeTiles, Rng, shuffle } from './tiles';

export type PlayerId = 1 | 2;
export const otherPlayer = (p: PlayerId): PlayerId => (p === 1 ? 2 : 1);

export interface MoveRecord {
  n: number;
  player: PlayerId;
  kind: 'play' | 'exchange' | 'pass' | 'reset' | 'finish';
  words?: { text: string; score: number }[];
  tiles?: number;
  bingo?: number;
  score: number;
  note?: string;
}

export interface GameResult {
  /** 0 means a draw. */
  winner: PlayerId | 0;
  reason: 'out' | 'stalemate' | 'resign' | 'left';
  /** End-of-game points added (or taken away) per player. */
  adjustments: Record<PlayerId, number>;
}

export interface GameState {
  id: string;
  version: number;
  grid: Grid;
  blanks: string[];
  bag: string[];
  racks: Record<PlayerId, string[]>;
  scores: Record<PlayerId, number>;
  current: PlayerId;
  /** Consecutive turns with no word played (passes and exchanges). */
  passStreak: number;
  /** Squares filled by the most recent play, for highlighting. */
  lastPlaced: string[];
  history: MoveRecord[];
  status: 'playing' | 'over';
  result: GameResult | null;
  startedAt: number;
}

export type ActionResult =
  | { ok: true; state: GameState; record: MoveRecord; evaluation?: MoveEvaluation }
  | { ok: false; error: string; evaluation?: MoveEvaluation };

const HISTORY_LIMIT = 120;

const randomId = (rng: Rng) => Math.floor(rng() * 36 ** 8).toString(36).padStart(8, '0');

export function newGame({ starter = 1, rng = Math.random }: { starter?: PlayerId; rng?: Rng } = {}): GameState {
  const bag = createBag(rng);
  return {
    id: randomId(rng),
    version: 1,
    grid: createGrid(),
    blanks: [],
    racks: { 1: bag.splice(0, RACK_SIZE), 2: bag.splice(0, RACK_SIZE) },
    bag,
    scores: { 1: 0, 2: 0 },
    current: starter,
    passStreak: 0,
    lastPlaced: [],
    history: [],
    status: 'playing',
    result: null,
    startedAt: Date.now(),
  };
}

const winnerOf = (scores: Record<PlayerId, number>): PlayerId | 0 =>
  scores[1] === scores[2] ? 0 : scores[1] > scores[2] ? 1 : 2;

function guard(state: GameState, player: PlayerId): string | null {
  if (state.status !== 'playing') return 'เกมจบแล้ว';
  if (state.current !== player) return 'ยังไม่ถึงตาของคุณ';
  return null;
}

function pushHistory(state: GameState, ...records: MoveRecord[]): MoveRecord[] {
  return [...state.history, ...records].slice(-HISTORY_LIMIT);
}

export function applyPlay(state: GameState, player: PlayerId, placements: Placement[], isWord: WordCheck): ActionResult {
  const blocked = guard(state, player);
  if (blocked) return { ok: false, error: blocked };

  const evaluation = evaluateMove(state.grid, new Set(state.blanks), placements, isWord);
  if (evaluation.error) return { ok: false, error: evaluation.error, evaluation };
  if (!evaluation.ok) {
    return { ok: false, error: `ไม่พบคำว่า ${evaluation.invalidWords.map((w) => `“${w}”`).join(', ')} ในพจนานุกรม`, evaluation };
  }

  const tiles = placements.filter((p) => isMainRow(p.r));
  const used = tiles.map((t) => t.rackTile ?? (t.isBlank ? '0' : t.char));
  const remaining = removeTiles(state.racks[player], used);
  if (!remaining) return { ok: false, error: 'เบี้ยที่วางไม่ตรงกับเบี้ยในมือ', evaluation };

  const drawn = state.bag.slice(0, tiles.length);
  const bag = state.bag.slice(tiles.length);
  const rack = [...remaining, ...drawn];
  const scores = { ...state.scores, [player]: state.scores[player] + evaluation.total } as Record<PlayerId, number>;
  const n = state.history.length + 1;
  const record: MoveRecord = {
    n,
    player,
    kind: 'play',
    words: evaluation.words.map((w) => ({ text: w.text, score: w.score })),
    tiles: tiles.length,
    bingo: evaluation.bingo,
    score: evaluation.total,
  };

  let next: GameState = {
    ...state,
    version: state.version + 1,
    grid: evaluation.grid,
    blanks: [...evaluation.blanks],
    bag,
    racks: { ...state.racks, [player]: rack } as Record<PlayerId, string[]>,
    scores,
    current: otherPlayer(player),
    passStreak: 0,
    lastPlaced: placements.map((p) => cellKey(p.r, p.c)),
    history: pushHistory(state, record),
  };

  // Out of tiles with the bag empty: the game ends and the player who went out gets
  // twice the value of the tiles left in the opponent's rack.
  if (bag.length === 0 && rack.length === 0) {
    const opponent = otherPlayer(player);
    const bonus = rackValue(next.racks[opponent]) * 2;
    const finalScores = { ...scores, [player]: scores[player] + bonus } as Record<PlayerId, number>;
    next = {
      ...next,
      scores: finalScores,
      status: 'over',
      result: { winner: winnerOf(finalScores), reason: 'out', adjustments: { [player]: bonus, [opponent]: 0 } as Record<PlayerId, number> },
      history: pushHistory(next, { n: n + 1, player, kind: 'finish', score: bonus, note: 'เบี้ยหมดมือ' }),
    };
  }
  return { ok: true, state: next, record, evaluation };
}

/** After a pass or exchange: six scoreless turns in a row end the game (bag empty) or clear the board. */
function afterScorelessTurn(state: GameState, player: PlayerId, record: MoveRecord): ActionResult {
  const passStreak = state.passStreak + 1;
  let next: GameState = {
    ...state,
    version: state.version + 1,
    current: otherPlayer(player),
    passStreak,
    lastPlaced: [],
    history: pushHistory(state, record),
  };
  if (passStreak < STALEMATE_LIMIT) return { ok: true, state: next, record };

  if (state.bag.length === 0) {
    const adjustments = { 1: -rackValue(state.racks[1]), 2: -rackValue(state.racks[2]) } as Record<PlayerId, number>;
    const scores = { 1: state.scores[1] + adjustments[1], 2: state.scores[2] + adjustments[2] } as Record<PlayerId, number>;
    next = {
      ...next,
      scores,
      status: 'over',
      result: { winner: winnerOf(scores), reason: 'stalemate', adjustments },
      history: pushHistory(next, { n: record.n + 1, player, kind: 'finish', score: 0, note: 'ไม่มีใครลงคำได้ หักแต้มเบี้ยในมือ' }),
    };
  } else {
    next = {
      ...next,
      grid: createGrid(),
      blanks: [],
      passStreak: 0,
      history: pushHistory(next, { n: record.n + 1, player, kind: 'reset', score: 0, note: 'ข้ามติดกัน 6 ตา เริ่มกระดานใหม่ที่ดาว' }),
    };
  }
  return { ok: true, state: next, record };
}

export function applyPass(state: GameState, player: PlayerId): ActionResult {
  const blocked = guard(state, player);
  if (blocked) return { ok: false, error: blocked };
  return afterScorelessTurn(state, player, { n: state.history.length + 1, player, kind: 'pass', score: 0 });
}

export function applyExchange(state: GameState, player: PlayerId, tiles: string[], rng: Rng = Math.random): ActionResult {
  const blocked = guard(state, player);
  if (blocked) return { ok: false, error: blocked };
  if (tiles.length === 0) return { ok: false, error: 'เลือกเบี้ยที่ต้องการแลกก่อน' };
  if (state.bag.length < tiles.length) return { ok: false, error: `เหลือเบี้ยในถุง ${state.bag.length} ตัว แลกได้ไม่เกินนั้น` };
  const remaining = removeTiles(state.racks[player], tiles);
  if (!remaining) return { ok: false, error: 'เบี้ยที่เลือกไม่อยู่ในมือ' };

  const drawn = state.bag.slice(0, tiles.length);
  const bag = shuffle([...state.bag.slice(tiles.length), ...tiles], rng);
  const exchanged: GameState = {
    ...state,
    bag,
    racks: { ...state.racks, [player]: [...remaining, ...drawn] } as Record<PlayerId, string[]>,
  };
  return afterScorelessTurn(exchanged, player, {
    n: state.history.length + 1,
    player,
    kind: 'exchange',
    tiles: tiles.length,
    score: 0,
  });
}

/** A player resigns or leaves an online game; the other player wins. */
export function applyForfeit(state: GameState, loser: PlayerId, reason: 'resign' | 'left'): GameState {
  if (state.status !== 'playing') return state;
  return {
    ...state,
    version: state.version + 1,
    status: 'over',
    result: { winner: otherPlayer(loser), reason, adjustments: { 1: 0, 2: 0 } },
    history: pushHistory(state, {
      n: state.history.length + 1,
      player: loser,
      kind: 'finish',
      score: 0,
      note: reason === 'resign' ? 'ยอมแพ้' : 'ออกจากเกม',
    }),
  };
}

/** Moves a player's tiles around without changing which tiles they hold. */
export function reorderRack(state: GameState, player: PlayerId, rack: string[]): GameState {
  const same = [...rack].sort().join() === [...state.racks[player]].sort().join();
  return same ? { ...state, racks: { ...state.racks, [player]: rack } as Record<PlayerId, string[]> } : state;
}

// --- Network form -------------------------------------------------------------------

export type WireState = Omit<GameState, 'grid' | 'history'> & { grid: SparseGrid };

export function toWire(state: GameState): WireState {
  const wire: Record<string, unknown> = { ...state, grid: toSparse(state.grid) };
  delete wire.history;
  return wire as unknown as WireState;
}

export const fromWire = (wire: WireState, history: MoveRecord[]): GameState => ({
  ...wire,
  grid: fromSparse(wire.grid),
  history,
});

// --- Saved games ---------------------------------------------------------------------

export const serializeGame = (state: GameState) => JSON.stringify({ ...state, grid: toSparse(state.grid) });

export function deserializeGame(json: string): GameState | null {
  try {
    const raw = JSON.parse(json);
    if (!raw || !Array.isArray(raw.grid) || !raw.racks || !raw.scores) return null;
    return { ...raw, grid: fromSparse(raw.grid) } as GameState;
  } catch {
    return null;
  }
}
