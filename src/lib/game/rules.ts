// Move validation and scoring. One function, evaluateMove, is the single source of truth
// used by the player's live preview, the submit button, the bot and the hint.

import { BINGO_BONUS, BOARD_COLS, LETTER_SCORES, STAR } from './constants';
import {
  cellKey,
  clusterAt,
  cloneGrid,
  Coord,
  createGrid,
  Grid,
  hasTile,
  isBoardEmpty,
  isMainRow,
  lowerMarksAt,
  markHost,
  premiumAt,
  upperMarksAt,
} from './board';
import { isLowerContent, isMainChar, isValidMarkContent, normalizeThai } from './thai';

export interface Placement {
  r: number;
  c: number;
  /**
   * The letter for a tile square, or the full content of a mark cell (e.g. "ี่"). An empty
   * string removes the marks of a letter that is being replaced.
   */
  char: string;
  /** Tile only: placed from a blank, so it scores 0. */
  isBlank?: boolean;
  /** Tile only: the rack tile it came from ("ก", "ฆ/ซ" or "0"). Defaults to char. */
  rackTile?: string;
}

export interface WordInfo {
  text: string;
  dir: 'h' | 'v';
  cells: Coord[];
}

export interface ScoredWord extends WordInfo {
  letterPoints: number;
  wordMultiplier: number;
  score: number;
  /** How the score was worked out, e.g. "(1 + 3×2 + 1) ×2 = 16". */
  detail: string;
  /** Dictionary result, or null when no dictionary was given. */
  valid: boolean | null;
}

export interface MoveEvaluation {
  /** Structurally legal and, when a dictionary was given, every word is in it. */
  ok: boolean;
  /** Why the placement itself is illegal, or null. */
  error: string | null;
  words: ScoredWord[];
  invalidWords: string[];
  tilesPlaced: number;
  bingo: number;
  total: number;
  grid: Grid;
  blanks: Set<string>;
}

export type WordCheck = (word: string) => boolean;

export const bingoBonus = (tilesPlaced: number) => BINGO_BONUS[Math.min(tilesPlaced, 9)] ?? 0;

const neighbours = (r: number, c: number): Coord[] => [
  { r: r - 2, c },
  { r: r + 2, c },
  { r, c: c - 1 },
  { r, c: c + 1 },
];

/** Every word of two or more letters that runs through one of the given letter squares. */
export function findWords(grid: Grid, touched: Coord[]): WordInfo[] {
  const found = new Map<string, WordInfo>();
  for (const { r, c } of touched) {
    if (!hasTile(grid, r, c)) continue;

    let c0 = c;
    let c1 = c;
    while (c0 > 0 && grid[r][c0 - 1]) c0--;
    while (c1 < BOARD_COLS - 1 && grid[r][c1 + 1]) c1++;
    if (c1 > c0 && !found.has(`h${r},${c0}`)) {
      const cells: Coord[] = [];
      for (let x = c0; x <= c1; x++) cells.push({ r, c: x });
      found.set(`h${r},${c0}`, { dir: 'h', cells, text: wordText(grid, cells) });
    }

    let r0 = r;
    let r1 = r;
    while (hasTile(grid, r0 - 2, c)) r0 -= 2;
    while (hasTile(grid, r1 + 2, c)) r1 += 2;
    if (r1 > r0 && !found.has(`v${r0},${c}`)) {
      const cells: Coord[] = [];
      for (let y = r0; y <= r1; y += 2) cells.push({ r: y, c });
      found.set(`v${r0},${c}`, { dir: 'v', cells, text: wordText(grid, cells) });
    }
  }
  return [...found.values()];
}

const wordText = (grid: Grid, cells: Coord[]) => normalizeThai(cells.map(({ r, c }) => clusterAt(grid, r, c)).join(''));

export function scoreWord(grid: Grid, word: WordInfo, newTiles: Set<string>, blanks: Set<string>): Omit<ScoredWord, 'valid'> {
  let letterPoints = 0;
  let wordMultiplier = 1;
  const parts: string[] = [];
  for (const { r, c } of word.cells) {
    const key = cellKey(r, c);
    const base = blanks.has(key) ? 0 : (LETTER_SCORES[grid[r][c] ?? ''] ?? 0);
    let value = base;
    let part = `${base}`;
    if (newTiles.has(key)) {
      const premium = premiumAt(r, c);
      if (premium === '2L' || premium === '3L' || premium === '4L' || premium === '5L') {
        const n = Number(premium[0]);
        value = base * n;
        part = `${base}×${n}`;
      } else if (premium === '2W' || premium === 'STAR') wordMultiplier *= 2;
      else if (premium === '3W') wordMultiplier *= 3;
    }
    letterPoints += value;
    parts.push(part);
  }
  const score = letterPoints * wordMultiplier;
  const sum = parts.join(' + ');
  const detail = wordMultiplier > 1 ? `(${sum}) ×${wordMultiplier} = ${score}` : `${sum} = ${score}`;
  return { ...word, letterPoints, wordMultiplier, score, detail };
}

/**
 * Official rule: after a turn, every earlier word comes off the board and only the words
 * made in that turn stay (with their vowels and tone marks).
 */
export function keepOnlyWords(grid: Grid, blanks: Set<string>, words: WordInfo[]): { grid: Grid; blanks: Set<string> } {
  const kept = createGrid();
  const keptBlanks = new Set<string>();
  for (const { r, c } of words.flatMap((w) => w.cells)) {
    kept[r][c] = grid[r][c];
    if (blanks.has(cellKey(r, c))) keptBlanks.add(cellKey(r, c));
    const up = upperMarksAt(grid, r, c);
    const down = lowerMarksAt(grid, r, c);
    if (up) kept[r - 1][c] = up;
    if (down) kept[r + 1][c] = down;
  }
  return { grid: kept, blanks: keptBlanks };
}

/** A mark placement may only add marks to a cell, never replace what is already there (unless its letter is being replaced). */
function extendsMarks(before: string | null, after: string): boolean {
  if (!before) return true;
  if (isLowerContent(before) || isLowerContent(after)) return false;
  return after !== before && [...before].every((ch) => after.includes(ch));
}

/**
 * Checks a set of placements against the board and scores it.
 * @param isWord optional dictionary lookup; without it only the placement rules are checked.
 */
export function evaluateMove(
  baseGrid: Grid,
  baseBlanks: ReadonlySet<string>,
  placements: Placement[],
  isWord?: WordCheck,
): MoveEvaluation {
  const tiles = placements.filter((p) => isMainRow(p.r));
  const marks = placements.filter((p) => !isMainRow(p.r));
  const grid = cloneGrid(baseGrid);
  const blanks = new Set(baseBlanks);
  const result = (error: string | null, extra: Partial<MoveEvaluation> = {}): MoveEvaluation => ({
    ok: false,
    error,
    words: [],
    invalidWords: [],
    tilesPlaced: tiles.length,
    bingo: 0,
    total: 0,
    grid,
    blanks,
    ...extra,
  });

  const seen = new Set<string>();
  for (const p of placements) {
    const key = cellKey(p.r, p.c);
    if (p.r < 0 || p.r >= grid.length || p.c < 0 || p.c >= BOARD_COLS) return result('ตำแหน่งอยู่นอกกระดาน');
    if (seen.has(key)) return result('วางซ้ำช่องเดิม');
    seen.add(key);
  }
  if (tiles.length === 0) return result('วางเบี้ยตัวอักษรอย่างน้อย 1 ตัว');
  if (tiles.some((t) => !isMainChar(t.char))) return result('มีเบี้ยที่ไม่ใช่ตัวอักษร');

  // Replacing a letter on the board (official rule: ต่อคำที่สมบูรณ์แล้วโดยมีตัวอักษรตัวหนึ่งเข้าไปแทนที่).
  const replaced = tiles.filter((t) => baseGrid[t.r][t.c]);
  if (replaced.length > 1) return result('แทนที่ตัวอักษรบนกระดานได้ตาละ 1 ตัว');
  const replacedKey = replaced.length ? cellKey(replaced[0].r, replaced[0].c) : null;
  // Marks of the replaced letter may be swapped or taken off; marks of other letters stay.
  const ownedByReplaced = (m: Placement) => {
    const before = baseGrid[m.r][m.c];
    const host = before ? markHost(m.r, m.c, before) : null;
    return !!host && cellKey(host.r, host.c) === replacedKey;
  };
  for (const m of marks) {
    if (m.char === '') {
      if (!ownedByReplaced(m)) return result('เอาสระหรือวรรณยุกต์ออกได้เฉพาะของตัวอักษรที่ถูกแทนที่');
      continue;
    }
    if (!isValidMarkContent(m.char)) return result('สระหรือวรรณยุกต์ซ้อนกันไม่ถูกต้อง');
    if (!ownedByReplaced(m) && !extendsMarks(baseGrid[m.r][m.c], m.char)) return result('ช่องนี้มีสระหรือวรรณยุกต์อยู่แล้ว');
  }

  for (const t of tiles) {
    grid[t.r][t.c] = t.char;
    if (t.isBlank) blanks.add(cellKey(t.r, t.c));
    else blanks.delete(cellKey(t.r, t.c));
  }
  for (const m of marks) grid[m.r][m.c] = m.char || null;

  const sameRow = tiles.every((t) => t.r === tiles[0].r);
  const sameCol = tiles.every((t) => t.c === tiles[0].c);
  if (tiles.length > 1) {
    if (!sameRow && !sameCol) return result('เบี้ยต้องเรียงอยู่ในแถวเดียวหรือคอลัมน์เดียว');
    if (sameRow) {
      const cs = tiles.map((t) => t.c);
      for (let c = Math.min(...cs); c <= Math.max(...cs); c++) {
        if (!grid[tiles[0].r][c]) return result('ห้ามเว้นช่องว่างระหว่างเบี้ย');
      }
    } else {
      const rs = tiles.map((t) => t.r);
      for (let r = Math.min(...rs); r <= Math.max(...rs); r += 2) {
        if (!grid[r][tiles[0].c]) return result('ห้ามเว้นช่องว่างระหว่างเบี้ย');
      }
    }
  }

  if (replaced.length) {
    const { r, c, char } = replaced[0];
    if (baseGrid[r][c] === char) return result('ตัวอักษรที่แทนที่ต้องไม่ซ้ำกับตัวเดิม');
    const inRow = hasTile(baseGrid, r, c - 1) || hasTile(baseGrid, r, c + 1);
    const inCol = hasTile(baseGrid, r - 2, c) || hasTile(baseGrid, r + 2, c);
    if (inRow && inCol) return result('แทนที่ตัวอักษรที่เป็นจุดตัดของสองคำไม่ได้');
    if (tiles.length < 2 || (inRow && sameRow) || (inCol && sameCol)) {
      return result('แทนที่ตัวอักษรแล้วต้องต่อคำใหม่ในแนวตรงข้ามกับคำเดิม');
    }
  }

  if (isBoardEmpty(baseGrid)) {
    if (!tiles.some((t) => t.r === STAR.r && t.c === STAR.c)) return result('ตาแรกต้องวางผ่านช่องดาว ★');
  } else {
    const connected =
      replaced.length > 0 || tiles.some((t) => neighbours(t.r, t.c).some((n) => hasTile(baseGrid, n.r, n.c)));
    if (!connected) return result('ต้องวางต่อกับคำที่อยู่บนกระดาน');
  }

  const tileWords = findWords(grid, tiles);
  if (tileWords.length === 0) return result('ต้องต่อให้เป็นคำอย่างน้อย 2 ตัวอักษร');

  const covered = new Set(tileWords.flatMap((w) => w.cells.map((c) => cellKey(c.r, c.c))));
  const hosts: Coord[] = [];
  for (const m of marks.filter((mk) => mk.char)) {
    const host = markHost(m.r, m.c, m.char);
    if (!host || !hasTile(grid, host.r, host.c)) return result('สระและวรรณยุกต์ต้องอยู่บนหรือใต้ตัวอักษร');
    if (!covered.has(cellKey(host.r, host.c))) return result('สระและวรรณยุกต์ต้องอยู่บนคำที่กำลังลง');
    hosts.push(host);
  }

  const newTiles = new Set(tiles.map((t) => cellKey(t.r, t.c)));
  const words: ScoredWord[] = findWords(grid, [...tiles, ...hosts]).map((w) => {
    const scored = scoreWord(grid, w, newTiles, blanks);
    return { ...scored, valid: isWord ? isWord(scored.text) : null };
  });
  const invalidWords = words.filter((w) => w.valid === false).map((w) => w.text);
  const bingo = bingoBonus(tiles.length);
  const total = words.reduce((sum, w) => sum + w.score, 0) + bingo;

  return result(null, { ok: invalidWords.length === 0, words, invalidWords, bingo, total });
}
