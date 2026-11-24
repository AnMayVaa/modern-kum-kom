// Move generator. For every row and column on the board it tries every dictionary word at
// every start position, filling empty squares from the rack (including blanks and dual
// tiles) and adding the free vowels and tone marks a word needs. Each fitting move is then
// checked with evaluateMove, so the bot plays by exactly the same rules as a person.

import { BOARD_COLS, BOARD_ROWS, GRID_ROWS, STAR } from './constants';
import { cellKey, Grid, isBoardEmpty } from './board';
import { Dictionary, DictEntry } from './dictionary';
import { evaluateMove, Placement } from './rules';
import { isBlankTile, isDualTile, Rng, tileOptions } from './tiles';
import { isLowerContent } from './thai';

export type BotLevel = 'easy' | 'normal' | 'hard';

export const BOT_LEVELS: { id: BotLevel; label: string; hint: string }[] = [
  { id: 'easy', label: 'ง่าย', hint: 'ลงคำสั้น ๆ ไม่เน้นแต้ม' },
  { id: 'normal', label: 'ปานกลาง', hint: 'เลือกคำดี ๆ แต่ไม่เสมอไป' },
  { id: 'hard', label: 'ยาก', hint: 'หาคำที่ได้แต้มสูงสุดทุกตา' },
];

export interface CandidateMove {
  placements: Placement[];
  total: number;
  tiles: number;
  words: { text: string; score: number }[];
}

interface Pos {
  r: number;
  c: number;
}

/**
 * For each dictionary entry, how many of its letters the rack can't supply even with dual
 * tiles (they must come from the board or from blanks). -1 means the rack supplies none of
 * it, so the word can never be played this turn.
 */
function missingCounts(entries: DictEntry[], rack: string[]): { missing: Int8Array; blanks: number } {
  // Thai letters all sit in U+0E00–U+0E7F, so a small array indexed by code point beats a Map here.
  const exact = new Int8Array(128);
  const duals: string[][] = [];
  let blanks = 0;
  for (const t of rack) {
    if (isBlankTile(t)) blanks++;
    else if (isDualTile(t)) duals.push(tileOptions(t));
    else exact[t.charCodeAt(0) - 0x0e00]++;
  }
  const missing = new Int8Array(entries.length);
  const counts = new Int8Array(128);
  for (let idx = 0; idx < entries.length; idx++) {
    const cells = entries[idx].cells;
    counts.set(exact);
    const ds = duals.length ? [...duals] : duals;
    let miss = 0;
    for (let k = 0; k < cells.length; k++) {
      const code = cells[k].base.charCodeAt(0) - 0x0e00;
      if (code >= 0 && code < 128 && counts[code] > 0) {
        counts[code]--;
        continue;
      }
      const d = ds.length ? ds.findIndex((o) => o.includes(cells[k].base)) : -1;
      if (d >= 0) ds.splice(d, 1);
      else miss++;
    }
    missing[idx] = miss >= cells.length ? -1 : miss;
  }
  return { missing, blanks };
}

/** Picks rack tiles for the letters a move needs: exact tiles first, then dual tiles, then blanks. */
function allocate(letters: string[], rack: string[]): { tile: string; isBlank: boolean }[] | null {
  const pool = [...rack];
  const out: { tile: string; isBlank: boolean }[] = [];
  for (const letter of letters) {
    let i = pool.indexOf(letter);
    if (i === -1) i = pool.findIndex((t) => isDualTile(t) && tileOptions(t).includes(letter));
    let isBlank = false;
    if (i === -1) {
      i = pool.findIndex(isBlankTile);
      isBlank = true;
    }
    if (i === -1) return null;
    out.push({ tile: pool[i], isBlank });
    pool.splice(i, 1);
  }
  return out;
}

export interface GenerateOptions {
  /** Stop searching at this time (ms since epoch) and return what was found. */
  deadline?: number;
}

export function generateMoves(
  grid: Grid,
  blankKeys: Iterable<string>,
  rack: string[],
  dict: Dictionary,
  { deadline = Infinity }: GenerateOptions = {},
): CandidateMove[] {
  const blanks = new Set(blankKeys);
  const first = isBoardEmpty(grid);
  const entries = dict.entries;
  const index = dict.positionIndex;
  const { missing, blanks: blankCount } = missingCounts(entries, rack);
  const maxNew = rack.length;

  // Words the rack can build on its own (used for spans that contain no board tiles).
  const rackOnly: number[][] = Array.from({ length: BOARD_COLS + 1 }, () => []);
  missing.forEach((m, i) => {
    if (m >= 0 && m <= blankCount) rackOnly[entries[i].cells.length].push(i);
  });

  const results = new Map<string, CandidateMove>();
  const occupied = (p: Pos) => p.r >= 1 && p.r < GRID_ROWS && p.c >= 0 && p.c < BOARD_COLS && !!grid[p.r][p.c];

  // Each line knows where the star falls in it, for the opening move.
  const lines: { positions: Pos[]; perp: (p: Pos) => Pos[]; star: number }[] = [];
  for (let r = 1; r < GRID_ROWS; r += 2) {
    if (first && r !== STAR.r) continue;
    lines.push({
      star: STAR.c,
      positions: Array.from({ length: BOARD_COLS }, (_, c) => ({ r, c })),
      perp: (p) => [
        { r: p.r - 2, c: p.c },
        { r: p.r + 2, c: p.c },
      ],
    });
  }
  for (let c = 0; c < BOARD_COLS; c++) {
    if (first && c !== STAR.c) continue;
    lines.push({
      star: (STAR.r - 1) / 2,
      positions: Array.from({ length: BOARD_ROWS }, (_, i) => ({ r: i * 2 + 1, c })),
      perp: (p) => [
        { r: p.r, c: p.c - 1 },
        { r: p.r, c: p.c + 1 },
      ],
    });
  }

  for (const { positions, perp, star } of lines) {
    if (Date.now() > deadline) break;
    const size = positions.length;

    // A square is "hot" if a word covering it would touch the existing board.
    const filled = positions.map(occupied);
    const hot = positions.map((p, i) => filled[i] || perp(p).some(occupied));
    const hotPrefix = [0];
    hot.forEach((h, i) => hotPrefix.push(hotPrefix[i] + (h ? 1 : 0)));
    if (!first && hotPrefix[size] === 0) continue;

    for (let s = 0; s < size; s++) {
      if (s > 0 && filled[s - 1]) continue;
      const fixed: number[] = [];
      for (let len = 1; s + len <= size; len++) {
        const end = s + len - 1;
        if (filled[end]) fixed.push(end - s);
        if (len < 2) continue;
        if (len - fixed.length > maxNew) break;
        if (s + len < size && filled[s + len]) continue;
        if (fixed.length === len) continue;
        if (first) {
          if (s > star || end < star) continue;
        } else if (hotPrefix[s + len] - hotPrefix[s] === 0) continue;

        let candidates: number[] | undefined;
        if (fixed.length === 0) candidates = rackOnly[len];
        else {
          const at = fixed[0];
          candidates = index.get(`${len}|${at}|${grid[positions[s + at].r][positions[s + at].c]}`);
        }
        if (!candidates) continue;

        for (const idx of candidates) {
          const m = missing[idx];
          if (m < 0 || m > fixed.length + blankCount) continue;
          const entry = entries[idx];
          let match = true;
          for (let k = 1; k < fixed.length; k++) {
            const p = positions[s + fixed[k]];
            if (entry.cells[fixed[k]].base !== grid[p.r][p.c]) {
              match = false;
              break;
            }
          }
          if (!match) continue;

          const move = fit(entry, positions, s);
          if (!move) continue;
          const evaluation = evaluateMove(grid, blanks, move, dict.hasNormalized);
          if (!evaluation.ok) continue;
          const signature = move
            .map((p) => `${p.r},${p.c},${p.char},${p.isBlank ? 1 : 0}`)
            .sort()
            .join('|');
          if (!results.has(signature)) {
            results.set(signature, {
              placements: move,
              total: evaluation.total,
              tiles: evaluation.tilesPlaced,
              words: evaluation.words.map((w) => ({ text: w.text, score: w.score })),
            });
          }
        }
      }
    }
  }
  return [...results.values()].sort((a, b) => b.total - a.total);

  function fit(entry: DictEntry, positions: Pos[], s: number): Placement[] | null {
    const marks = new Map<string, string>();
    const markAt = (r: number, c: number) => marks.get(cellKey(r, c)) ?? grid[r][c];
    const needIdx: number[] = [];
    for (let i = 0; i < entry.cells.length; i++) {
      const cell = entry.cells[i];
      const p = positions[s + i];
      const existing = grid[p.r][p.c];
      if (existing) {
        if (existing !== cell.base) return null;
      } else needIdx.push(i);

      const upR = p.r - 1;
      const up = markAt(upR, p.c);
      const upMine = !!up && !isLowerContent(up);
      if (cell.upper) {
        if (!up) marks.set(cellKey(upR, p.c), cell.upper);
        else if (!upMine) return null;
        else if (up !== cell.upper) {
          if (!existing || ![...up].every((ch) => cell.upper.includes(ch))) return null;
          marks.set(cellKey(upR, p.c), cell.upper);
        }
      } else if (upMine) return null;

      const loR = p.r + 1;
      const lo = loR < GRID_ROWS ? markAt(loR, p.c) : null;
      const loMine = isLowerContent(lo);
      if (cell.lower) {
        if (loR >= GRID_ROWS) return null;
        if (!lo) marks.set(cellKey(loR, p.c), cell.lower);
        else if (!loMine || lo !== cell.lower) return null;
      } else if (loMine) return null;
    }
    if (needIdx.length === 0) return null;

    const tiles = allocate(
      needIdx.map((i) => entry.cells[i].base),
      rack,
    );
    if (!tiles) return null;

    const out: Placement[] = needIdx.map((i, k) => {
      const p = positions[s + i];
      return { r: p.r, c: p.c, char: entry.cells[i].base, isBlank: tiles[k].isBlank, rackTile: tiles[k].tile };
    });
    for (const [key, char] of marks) {
      const [r, c] = key.split(',').map(Number);
      out.push({ r, c, char });
    }
    return out;
  }
}

/** Chooses one move according to the difficulty level. */
export function pickMove(moves: CandidateMove[], level: BotLevel, rng: Rng = Math.random): CandidateMove | null {
  if (moves.length === 0) return null;
  const sorted = [...moves].sort((a, b) => b.total - a.total);
  if (level === 'hard') return sorted[0];
  if (level === 'normal') {
    const top = sorted.slice(0, Math.max(3, Math.ceil(sorted.length * 0.2)));
    return top[Math.floor(rng() * top.length)];
  }
  const modest = sorted.slice(Math.floor(sorted.length * 0.4)).filter((m) => m.tiles <= 4);
  const pool = modest.length ? modest : sorted.slice(-Math.max(1, Math.ceil(sorted.length / 2)));
  return pool[Math.floor(rng() * pool.length)];
}
