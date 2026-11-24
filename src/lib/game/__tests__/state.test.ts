import { describe, expect, it } from 'vitest';
import { INITIAL_LETTER_QUANTITIES, RACK_SIZE, STALEMATE_LIMIT } from '../constants';
import { Dictionary } from '../dictionary';
import { applyExchange, applyForfeit, applyPass, applyPlay, deserializeGame, fromWire, GameState, newGame, serializeGame, toWire } from '../state';
import { generateMoves, pickMove } from '../bot';
import { rackValue, shuffle } from '../tiles';
import { evaluateMove } from '../rules';
import { isMainRow } from '../board';

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const TOTAL_TILES = Object.values(INITIAL_LETTER_QUANTITIES).reduce((a, b) => a + b, 0);
const tilesOnBoard = (s: GameState) => s.grid.filter((_, r) => isMainRow(r)).flat().filter(Boolean).length;

const dict = new Dictionary([
  'กา', 'การ', 'กาย', 'กิน', 'นก', 'นา', 'มา', 'ยา', 'ตา', 'ดี', 'ดาว', 'ราว', 'ลม', 'นม', 'มด', 'กด', 'ปุ่ม', 'ที่',
  'ไม่', 'ไก่', 'ไป', 'มี', 'ดู', 'รู้', 'บ้าน', 'น้ำ', 'ปลา', 'เรา', 'เขา', 'แม่', 'พ่อ', 'โต', 'ใจ', 'จาน', 'งาน',
]);

describe('game state', () => {
  it('deals nine tiles each from a full bag', () => {
    const s = newGame({ rng: seeded(1) });
    expect(s.racks[1]).toHaveLength(RACK_SIZE);
    expect(s.racks[2]).toHaveLength(RACK_SIZE);
    expect(s.bag.length + 2 * RACK_SIZE).toBe(TOTAL_TILES);
  });

  it('plays a move, draws tiles and passes the turn', () => {
    const s: GameState = { ...newGame({ rng: seeded(2) }), racks: { 1: ['ก', 'า', 'ร', 'น', 'ม', 'ด', 'ย', 'ต', 'ล'], 2: newGame().racks[2] } };
    const res = applyPlay(s, 1, [{ r: 15, c: 7, char: 'ก' }, { r: 15, c: 8, char: 'า' }], dict.has);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.racks[1]).toHaveLength(RACK_SIZE);
    expect(res.state.bag).toHaveLength(s.bag.length - 2);
    expect(res.state.current).toBe(2);
    expect(res.state.scores[1]).toBe(4);
    expect(applyPlay(res.state, 1, [{ r: 17, c: 7, char: 'ด' }], dict.has).ok).toBe(false);
  });

  it('uses dual tiles and blanks from the rack', () => {
    const s: GameState = { ...newGame({ rng: seeded(3) }), racks: { 1: ['ฆ/ซ', '0', 'า'], 2: [] } };
    const res = applyPlay(
      s,
      1,
      [
        { r: 15, c: 7, char: 'ม', isBlank: true, rackTile: '0' },
        { r: 15, c: 8, char: 'า' },
      ],
      dict.has,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.state.racks[1].slice(0, 1)).toEqual(['ฆ/ซ']);
      expect(res.state.blanks).toEqual(['15,7']);
      expect(res.state.scores[1]).toBe(2); // blank 0 + า 1, ×2 star
    }
  });

  it('exchanges tiles without changing the tile count', () => {
    const s = newGame({ rng: seeded(4) });
    const res = applyExchange(s, 1, s.racks[1].slice(0, 3), seeded(5));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.bag.length).toBe(s.bag.length);
    expect(res.state.racks[1]).toHaveLength(RACK_SIZE);
    expect(res.state.passStreak).toBe(1);
    const small = { ...s, bag: s.bag.slice(0, 2) };
    expect(applyExchange(small, 1, s.racks[1].slice(0, 3)).ok).toBe(false);
  });

  it('clears the board after six scoreless turns while tiles remain', () => {
    let s = newGame({ rng: seeded(6) });
    s.grid[15][7] = 'ก';
    for (let i = 0; i < STALEMATE_LIMIT; i++) {
      const res = applyPass(s, s.current);
      if (!res.ok) throw new Error(res.error);
      s = res.state;
    }
    expect(s.grid[15][7]).toBeNull();
    expect(s.passStreak).toBe(0);
    expect(s.history.at(-1)?.kind).toBe('reset');
  });

  it('ends a stuck game with an empty bag and subtracts rack values', () => {
    let s: GameState = { ...newGame({ rng: seeded(7) }), bag: [], racks: { 1: ['ก'], 2: ['ฬ/ญ'] }, scores: { 1: 10, 2: 10 } };
    for (let i = 0; i < STALEMATE_LIMIT; i++) {
      const res = applyPass(s, s.current);
      if (!res.ok) throw new Error(res.error);
      s = res.state;
    }
    expect(s.status).toBe('over');
    expect(s.scores).toEqual({ 1: 9, 2: 2 });
    expect(s.result?.winner).toBe(1);
  });

  it('gives the player who goes out twice the opponent rack', () => {
    const s: GameState = { ...newGame({ rng: seeded(8) }), bag: [], racks: { 1: ['ก', 'า'], 2: ['ข', 'ค'] } };
    const res = applyPlay(s, 1, [{ r: 15, c: 7, char: 'ก' }, { r: 15, c: 8, char: 'า' }], dict.has);
    expect(res.ok && res.state.status).toBe('over');
    if (res.ok) {
      expect(res.state.result?.adjustments[1]).toBe(rackValue(['ข', 'ค']) * 2);
      expect(res.state.scores[1]).toBe(4 + 10);
    }
  });

  it('round-trips through the network and save formats', () => {
    const s = newGame({ rng: seeded(9) });
    s.grid[15][7] = 'ก';
    expect(fromWire(JSON.parse(JSON.stringify(toWire(s))), s.history).grid[15][7]).toBe('ก');
    expect(deserializeGame(serializeGame(s))?.grid[15][7]).toBe('ก');
    expect(deserializeGame('nonsense')).toBeNull();
  });

  it('ends the game when a player resigns', () => {
    const s = applyForfeit(newGame(), 1, 'resign');
    expect(s.status).toBe('over');
    expect(s.result?.winner).toBe(2);
  });

  it('shuffles fairly', () => {
    const counts = [0, 0, 0];
    const rng = seeded(10);
    for (let i = 0; i < 3000; i++) counts[shuffle([0, 1, 2], rng)[0]]++;
    counts.forEach((n) => expect(n).toBeGreaterThan(850));
  });
});

describe('bot', () => {
  it('finds legal opening moves through the star', () => {
    const s = newGame();
    const moves = generateMoves(s.grid, [], ['ก', 'า', 'ร', 'น', 'ม', 'ด', 'ไ', 'ป', 'ล'], dict);
    expect(moves.length).toBeGreaterThan(5);
    for (const m of moves) {
      const e = evaluateMove(s.grid, new Set(), m.placements, dict.has);
      expect(e.ok).toBe(true);
      expect(e.total).toBe(m.total);
    }
  });

  it('adds the free vowels and tone marks a word needs', () => {
    const s = newGame();
    const moves = generateMoves(s.grid, [], ['ป', 'ม', 'ท', 'บ', 'า', 'น'], dict);
    const texts = moves.flatMap((m) => m.words.map((w) => w.text));
    expect(texts).toContain('ปุ่ม');
    expect(texts).toContain('บ้าน');
  });

  it('uses a blank for a missing letter', () => {
    const moves = generateMoves(newGame().grid, [], ['0', 'า'], dict);
    expect(moves.some((m) => m.placements.some((p) => p.isBlank))).toBe(true);
  });

  it('plays a whole game against itself without breaking the rules', () => {
    const rng = seeded(11);
    let s = newGame({ rng });
    let guard = 0;
    while (s.status === 'playing' && guard++ < 200) {
      const p = s.current;
      const move = pickMove(generateMoves(s.grid, s.blanks, s.racks[p], dict), 'hard', rng);
      const res = move
        ? applyPlay(s, p, move.placements, dict.has)
        : s.bag.length >= s.racks[p].length
          ? applyExchange(s, p, s.racks[p], rng)
          : applyPass(s, p);
      if (!res.ok) throw new Error(res.error);
      s = res.state;
      const resets = s.history.filter((h) => h.kind === 'reset').length;
      if (resets === 0) {
        expect(s.bag.length + s.racks[1].length + s.racks[2].length + tilesOnBoard(s)).toBe(TOTAL_TILES);
      }
    }
    expect(s.history.filter((h) => h.kind === 'play').length).toBeGreaterThan(2);
  });

  it('chooses weaker moves on easy than on hard', () => {
    const moves = generateMoves(newGame().grid, [], ['ก', 'า', 'ร', 'น', 'ม', 'ด', 'ไ', 'ป', 'ล'], dict);
    const hard = pickMove(moves, 'hard')!;
    const easy = pickMove(moves, 'easy', seeded(12))!;
    expect(hard.total).toBe(moves[0].total);
    expect(easy.total).toBeLessThanOrEqual(hard.total);
  });
});
