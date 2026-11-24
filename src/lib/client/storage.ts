'use client';

import { deserializeGame, GameState, PlayerId, serializeGame } from '@/lib/game/state';
import type { BotLevel } from '@/lib/game/bot';

const KEYS = {
  name: 'kumkom_name',
  level: 'kumkom_bot_level',
  solo: 'kumkom_solo_v2',
  stats: 'kumkom_stats_v1',
};

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage full or blocked (private mode): the game still works, it just isn't saved
  }
}

export const loadName = () => read(KEYS.name) ?? '';
export const saveName = (name: string | null) => write(KEYS.name, name);

export const loadLevel = (): BotLevel => {
  const v = read(KEYS.level);
  return v === 'easy' || v === 'hard' ? v : 'normal';
};
export const saveLevel = (level: BotLevel) => write(KEYS.level, level);

// --- Solo game in progress --------------------------------------------------------

export interface SavedSolo {
  state: GameState;
  level: BotLevel;
}

export function loadSolo(): SavedSolo | null {
  const raw = read(KEYS.solo);
  if (!raw) return null;
  try {
    const { game, level } = JSON.parse(raw) as { game: string; level: BotLevel };
    const state = deserializeGame(game);
    return state && state.status === 'playing' ? { state, level } : null;
  } catch {
    return null;
  }
}
export const saveSolo = (state: GameState, level: BotLevel) =>
  write(KEYS.solo, state.status === 'playing' ? JSON.stringify({ game: serializeGame(state), level }) : null);
export const clearSolo = () => write(KEYS.solo, null);

// --- Stats --------------------------------------------------------------------------

export interface MatchRecord {
  id: string;
  at: number;
  mode: 'solo' | 'online';
  level?: BotLevel;
  opponent: string;
  myScore: number;
  opponentScore: number;
  result: 'win' | 'loss' | 'draw';
  bestMove?: { words: string; score: number };
}

export interface Stats {
  played: number;
  wins: number;
  losses: number;
  draws: number;
  highScore: number;
  bestMove: { words: string; score: number } | null;
  recent: MatchRecord[];
}

const EMPTY_STATS: Stats = { played: 0, wins: 0, losses: 0, draws: 0, highScore: 0, bestMove: null, recent: [] };

export function loadStats(): Stats {
  try {
    return { ...EMPTY_STATS, ...(JSON.parse(read(KEYS.stats) ?? '{}') as Partial<Stats>) };
  } catch {
    return EMPTY_STATS;
  }
}

/** Records a finished game once (repeat calls for the same game are ignored). */
export function recordMatch(state: GameState, me: PlayerId, mode: 'solo' | 'online', opponent: string, level?: BotLevel) {
  if (state.status !== 'over' || !state.result) return;
  const stats = loadStats();
  if (stats.recent.some((m) => m.id === state.id)) return;
  const other: PlayerId = me === 1 ? 2 : 1;
  const result = state.result.winner === 0 ? 'draw' : state.result.winner === me ? 'win' : 'loss';
  const mine = state.history.filter((h) => h.player === me && h.kind === 'play');
  const best = mine.reduce<(typeof mine)[number] | null>((a, b) => (!a || b.score > a.score ? b : a), null);
  const bestMove = best ? { words: (best.words ?? []).map((w) => w.text).join(', '), score: best.score } : undefined;
  const record: MatchRecord = {
    id: state.id,
    at: Date.now(),
    mode,
    level,
    opponent,
    myScore: state.scores[me],
    opponentScore: state.scores[other],
    result,
    bestMove,
  };
  const next: Stats = {
    played: stats.played + 1,
    wins: stats.wins + (result === 'win' ? 1 : 0),
    losses: stats.losses + (result === 'loss' ? 1 : 0),
    draws: stats.draws + (result === 'draw' ? 1 : 0),
    highScore: Math.max(stats.highScore, record.myScore),
    bestMove: bestMove && (!stats.bestMove || bestMove.score > stats.bestMove.score) ? bestMove : stats.bestMove,
    recent: [record, ...stats.recent].slice(0, 20),
  };
  write(KEYS.stats, JSON.stringify(next));
}

export const resetStats = () => write(KEYS.stats, null);
