import { describe, expect, it } from 'vitest';
import { INITIAL_LETTER_QUANTITIES, RACK_SIZE, STALEMATE_LIMIT, STAR } from '../constants';
import { Dictionary } from '../dictionary';
import {
  addTime,
  applyExchange,
  applyForfeit,
  applyInvalidPlay,
  applyPass,
  applyPlay,
  deserializeGame,
  fromWire,
  GameState,
  hintsLeft,
  newGame,
  serializeGame,
  spendHint,
  timePenalty,
  toWire,
} from '../state';
import { generateMoves, pickMove } from '../bot';
import { rackValue, shuffle, startRank } from '../tiles';
import { evaluateMove } from '../rules';
import { isMainRow } from '../board';

const R = STAR.r;
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const TOTAL_TILES = Object.values(INITIAL_LETTER_QUANTITIES).reduce((a, b) => a + b, 0);
const tilesOnBoard = (s: GameState) => s.grid.filter((_, r) => isMainRow(r)).flat().filter(Boolean).length;

const dict = new Dictionary([
  'กา', 'การ', 'กาย', 'กิน', 'นก', 'นา', 'มา', 'ยา', 'ตา', 'ดี', 'ดาว', 'ราว', 'ลม', 'นม', 'มด', 'กด', 'ปุ่ม', 'ที่',
  'ไม่', 'ไก่', 'ไป', 'มี', 'ดู', 'รู้', 'บ้าน', 'น้ำ', 'ปลา', 'เรา', 'เขา', 'แม่', 'พ่อ', 'โต', 'ใจ', 'จาน', 'งาน', 'ต่ำ',
]);

describe('game state', () => {
  it('has 104 tiles and deals nine to each player', () => {
    expect(TOTAL_TILES).toBe(104);
    const s = newGame({ rng: seeded(1) });
    expect(s.racks[1]).toHaveLength(RACK_SIZE);
    expect(s.racks[2]).toHaveLength(RACK_SIZE);
    expect(s.bag.length + 2 * RACK_SIZE).toBe(104);
  });

  it('draws for the first turn: blank first, then ก to ฮ, vowels last', () => {
    expect(startRank('0')).toBeLessThan(startRank('ก'));
    expect(startRank('ก')).toBeLessThan(startRank('ฮ/ฦ'));
    expect(startRank('ฆ/ซ')).toBe(startRank('ฆ'));
    expect(startRank('ฮ/ฦ')).toBeLessThan(startRank('ะ'));
    for (let seed = 1; seed < 30; seed++) {
      const s = newGame({ rng: seeded(seed) });
      const { 1: a, 2: b } = s.opening!;
      expect(s.current).toBe(startRank(a) < startRank(b) ? 1 : 2);
    }
  });

  it('plays a move, draws tiles and passes the turn', () => {
    const base = newGame({ rng: seeded(2), starter: 1 });
    const s: GameState = { ...base, racks: { 1: ['ก', 'า', 'ร', 'น', 'ม', 'ด', 'ย', 'ต', 'ล'], 2: base.racks[2] } };
    const res = applyPlay(s, 1, [{ r: R, c: 7, char: 'ก' }, { r: R, c: 8, char: 'า' }], dict.has);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.racks[1]).toHaveLength(RACK_SIZE);
    expect(res.state.bag).toHaveLength(s.bag.length - 2);
    expect(res.state.current).toBe(2);
    expect(res.state.scores[1]).toBe(4);
    expect(applyPlay(res.state, 1, [{ r: R + 2, c: 7, char: 'ด' }], dict.has).ok).toBe(false);
  });

  it('keeps only the newest words on the board after each play', () => {
    const base = newGame({ rng: seeded(3), starter: 1 });
    let s: GameState = { ...base, racks: { 1: ['ก', 'า', 'ร'], 2: ['ด', 'ม'] } };
    let res = applyPlay(s, 1, [{ r: R, c: 6, char: 'ก' }, { r: R, c: 7, char: 'า' }, { r: R, c: 8, char: 'ร' }], dict.has);
    if (!res.ok) throw new Error(res.error);
    s = { ...res.state, racks: { ...res.state.racks, 2: ['ด', 'ม'] } };
    // มด under the ก of การ? No: กด down from ก — the word การ goes, only กด stays
    res = applyPlay(s, 2, [{ r: R + 2, c: 6, char: 'ด' }], dict.has);
    if (!res.ok) throw new Error(res.error);
    expect(res.state.grid[R][6]).toBe('ก');
    expect(res.state.grid[R + 2][6]).toBe('ด');
    expect(res.state.grid[R][7]).toBeNull();
    expect(res.state.grid[R][8]).toBeNull();
  });

  it('uses dual tiles and blanks from the rack', () => {
    const s: GameState = { ...newGame({ rng: seeded(3), starter: 1 }), racks: { 1: ['ฆ/ซ', '0', 'า'], 2: [] } };
    const res = applyPlay(s, 1, [{ r: R, c: 7, char: 'ม', isBlank: true, rackTile: '0' }, { r: R, c: 8, char: 'า' }], dict.has);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.state.racks[1].slice(0, 1)).toEqual(['ฆ/ซ']);
      expect(res.state.blanks).toEqual([`${R},7`]);
      expect(res.state.scores[1]).toBe(2);
    }
  });

  it('exchanges tiles only while 9 or more are left in the bag', () => {
    const s = newGame({ rng: seeded(4), starter: 1 });
    const res = applyExchange(s, 1, s.racks[1].slice(0, 3), seeded(5));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.state.bag.length).toBe(s.bag.length);
      expect(res.state.racks[1]).toHaveLength(RACK_SIZE);
      expect(res.state.passStreak).toBe(1);
    }
    const low = applyExchange({ ...s, bag: s.bag.slice(0, 8) }, 1, s.racks[1].slice(0, 1));
    expect(low.ok).toBe(false);
  });

  it('clears the board after six scoreless turns while tiles remain', () => {
    let s = newGame({ rng: seeded(6) });
    s.grid[R][7] = 'ก';
    for (let i = 0; i < STALEMATE_LIMIT; i++) {
      const res = applyPass(s, s.current);
      if (!res.ok) throw new Error(res.error);
      s = res.state;
    }
    expect(s.grid[R][7]).toBeNull();
    expect(s.history.at(-1)?.kind).toBe('reset');
  });

  it('ends a stuck game with an empty bag and subtracts rack values', () => {
    let s: GameState = { ...newGame({ rng: seeded(7), starter: 1 }), bag: [], racks: { 1: ['ก'], 2: ['ฬ/ญ'] }, scores: { 1: 10, 2: 10 } };
    for (let i = 0; i < STALEMATE_LIMIT; i++) {
      const res = applyPass(s, s.current);
      if (!res.ok) throw new Error(res.error);
      s = res.state;
    }
    expect(s.status).toBe('over');
    expect(s.scores).toEqual({ 1: 9, 2: 2 });
  });

  it('gives the player who goes out twice the opponent rack', () => {
    const s: GameState = { ...newGame({ rng: seeded(8), starter: 1 }), bag: [], racks: { 1: ['ก', 'า'], 2: ['ข', 'ค'] } };
    const res = applyPlay(s, 1, [{ r: R, c: 7, char: 'ก' }, { r: R, c: 8, char: 'า' }], dict.has);
    expect(res.ok && res.state.status).toBe('over');
    if (res.ok) expect(res.state.scores[1]).toBe(4 + rackValue(['ข', 'ค']) * 2);
  });

  it('takes 10 points per started minute over the game clock', () => {
    const s = newGame({ rng: seeded(9), starter: 1, settings: { timer: { kind: 'game', minutes: 25 }, hints: 0, strict: false } });
    expect(timePenalty(addTime(s, 1, 25 * 60_000), 1)).toBe(0);
    expect(timePenalty(addTime(s, 1, 25 * 60_000 + 1), 1)).toBe(10);
    expect(timePenalty(addTime(s, 1, 27 * 60_000 + 5), 1)).toBe(30);
    const out: GameState = { ...addTime(s, 1, 26 * 60_000 + 1), bag: [], racks: { 1: ['ก', 'า'], 2: ['ข'] } };
    const res = applyPlay(out, 1, [{ r: R, c: 7, char: 'ก' }, { r: R, c: 8, char: 'า' }], dict.has);
    if (res.ok) expect(res.state.scores[1]).toBe(4 + 6 - 20);
  });

  it('loses the turn for a word that is not in the dictionary (tournament check)', () => {
    const s = newGame({ rng: seeded(10), starter: 1 });
    const res = applyInvalidPlay(s, 1, ['กข']);
    expect(res.ok && res.state.current).toBe(2);
    if (res.ok) {
      expect(res.state.scores[1]).toBe(0);
      expect(res.state.racks[1]).toEqual(s.racks[1]);
      expect(res.state.history.at(-1)?.kind).toBe('invalid');
    }
  });

  it('counts hints', () => {
    const s = newGame({ rng: seeded(11), settings: { timer: { kind: 'off' }, hints: 3, strict: false } });
    expect(hintsLeft(s, 1)).toBe(3);
    expect(hintsLeft(spendHint(spendHint(s, 1), 1), 1)).toBe(1);
    expect(hintsLeft(newGame(), 1)).toBeNull();
  });

  it('round-trips through the network and save formats', () => {
    const s = newGame({ rng: seeded(12) });
    s.grid[R][7] = 'ก';
    expect(fromWire(JSON.parse(JSON.stringify(toWire(s))), s.history).grid[R][7]).toBe('ก');
    expect(deserializeGame(serializeGame(s))?.grid[R][7]).toBe('ก');
    expect(deserializeGame('nonsense')).toBeNull();
  });

  it('ends the game when a player resigns', () => {
    expect(applyForfeit(newGame(), 1, 'resign').result?.winner).toBe(2);
  });

  it('shuffles fairly', () => {
    const counts = [0, 0, 0];
    const rng = seeded(13);
    for (let i = 0; i < 3000; i++) counts[shuffle([0, 1, 2], rng)[0]]++;
    counts.forEach((n) => expect(n).toBeGreaterThan(850));
  });
});

describe('bot', () => {
  it('finds legal opening moves through the star, across and down', () => {
    const s = newGame();
    const moves = generateMoves(s.grid, [], ['ก', 'า', 'ร', 'น', 'ม', 'ด', 'ไ', 'ป', 'ล'], dict);
    expect(moves.length).toBeGreaterThan(5);
    expect(moves.some((m) => m.placements.every((p) => p.c === STAR.c))).toBe(true);
    for (const m of moves) {
      const e = evaluateMove(s.grid, new Set(), m.placements, dict.has);
      expect(e.ok).toBe(true);
      expect(e.total).toBe(m.total);
    }
  });

  it('adds the free vowels and tone marks a word needs', () => {
    const texts = generateMoves(newGame().grid, [], ['ป', 'ม', 'ท', 'บ', 'า', 'น', 'ต', 'ำ'], dict).flatMap((m) => m.words.map((w) => w.text));
    expect(texts).toContain('ปุ่ม');
    expect(texts).toContain('บ้าน');
    expect(texts).toContain('ต่ำ');
  });

  it('uses a blank for a missing letter', () => {
    expect(generateMoves(newGame().grid, [], ['0', 'า'], dict).some((m) => m.placements.some((p) => p.isBlank))).toBe(true);
  });

  it('plays a whole game against itself without breaking the rules', () => {
    const rng = seeded(14);
    let s = newGame({ rng });
    let discarded = 0;
    for (let guard = 0; s.status === 'playing' && guard < 200; guard++) {
      const p = s.current;
      const before = tilesOnBoard(s);
      const move = pickMove(generateMoves(s.grid, s.blanks, s.racks[p], dict), 'hard', rng);
      const res = move
        ? applyPlay(s, p, move.placements, dict.has)
        : s.bag.length >= 9
          ? applyExchange(s, p, s.racks[p], rng)
          : applyPass(s, p);
      if (!res.ok) throw new Error(res.error);
      if (res.record.kind === 'play') discarded += before + (res.record.tiles ?? 0) - tilesOnBoard(res.state);
      s = res.state;
      if (!s.history.some((h) => h.kind === 'reset')) {
        expect(s.bag.length + s.racks[1].length + s.racks[2].length + tilesOnBoard(s) + discarded).toBe(TOTAL_TILES);
      }
    }
    expect(s.history.filter((h) => h.kind === 'play').length).toBeGreaterThan(0);
  });
});
