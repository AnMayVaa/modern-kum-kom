// Grid helpers. See constants.ts for how the 19×15 grid maps onto the 15×9 board.

import { BOARD_LAYOUT, BOARD_COLS, GRID_ROWS, Premium } from './constants';
import { clusterText, isLowerContent } from './thai';

export type Grid = (string | null)[][];
export interface Coord {
  r: number;
  c: number;
}

export const cellKey = (r: number, c: number) => `${r},${c}`;
export const parseKey = (key: string): Coord => {
  const [r, c] = key.split(',').map(Number);
  return { r, c };
};

export const createGrid = (): Grid => Array.from({ length: GRID_ROWS }, () => Array<string | null>(BOARD_COLS).fill(null));
export const cloneGrid = (grid: Grid): Grid => grid.map((row) => [...row]);

export const isMainRow = (r: number) => r % 2 === 1;
export const inBounds = (r: number, c: number) => r >= 0 && r < GRID_ROWS && c >= 0 && c < BOARD_COLS;
export const boardRow = (r: number) => (r - 1) / 2;

export const premiumAt = (r: number, c: number): Premium => (isMainRow(r) ? BOARD_LAYOUT[boardRow(r)][c] : null);

export const hasTile = (grid: Grid, r: number, c: number) => inBounds(r, c) && isMainRow(r) && !!grid[r][c];

export function isBoardEmpty(grid: Grid): boolean {
  for (let r = 1; r < GRID_ROWS; r += 2) {
    for (let c = 0; c < BOARD_COLS; c++) if (grid[r][c]) return false;
  }
  return true;
}

/** Upper marks sitting on the letter at (r, c). */
export function upperMarksAt(grid: Grid, r: number, c: number): string {
  const content = r > 0 ? grid[r - 1][c] : null;
  return content && !isLowerContent(content) ? content : '';
}

/** Lower vowel sitting under the letter at (r, c). */
export function lowerMarksAt(grid: Grid, r: number, c: number): string {
  const content = r + 1 < GRID_ROWS ? grid[r + 1][c] : null;
  return content && isLowerContent(content) ? content : '';
}

/** The letter a mark cell belongs to, decided by what the cell holds. */
export function markHost(r: number, c: number, content: string): Coord | null {
  const host = isLowerContent(content) ? { r: r - 1, c } : { r: r + 1, c };
  return inBounds(host.r, host.c) ? host : null;
}

/** The letter at (r, c) together with its marks, e.g. "กี่". */
export function clusterAt(grid: Grid, r: number, c: number): string {
  const base = grid[r][c];
  if (!base) return '';
  return clusterText(base, upperMarksAt(grid, r, c), lowerMarksAt(grid, r, c));
}

/** Compact form for sending over the network: only filled cells. */
export type SparseGrid = [number, number, string][];

export function toSparse(grid: Grid): SparseGrid {
  const out: SparseGrid = [];
  grid.forEach((row, r) => row.forEach((ch, c) => ch && out.push([r, c, ch])));
  return out;
}

export function fromSparse(cells: SparseGrid): Grid {
  const grid = createGrid();
  for (const [r, c, ch] of cells) if (inBounds(r, c)) grid[r][c] = ch;
  return grid;
}
