// Tile bag and rack helpers.

import { BLANK, INITIAL_LETTER_QUANTITIES, LETTER_SCORES } from './constants';

export type Rng = () => number;

/** Fisher–Yates shuffle (sort(() => Math.random() - 0.5) is biased). */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function createBag(rng: Rng = Math.random): string[] {
  const bag: string[] = [];
  for (const [tile, qty] of Object.entries(INITIAL_LETTER_QUANTITIES)) {
    for (let i = 0; i < qty; i++) bag.push(tile);
  }
  return shuffle(bag, rng);
}

export const isDualTile = (tile: string) => tile.includes('/');
export const isBlankTile = (tile: string) => tile === BLANK;

/** Letters a rack tile can be played as. A blank returns an empty list (it can be anything). */
export const tileOptions = (tile: string): string[] => (isBlankTile(tile) ? [] : tile.split('/'));

export const tileValue = (tile: string) => (isBlankTile(tile) ? 0 : (LETTER_SCORES[tileOptions(tile)[0]] ?? 0));
export const rackValue = (rack: readonly string[]) => rack.reduce((sum, t) => sum + tileValue(t), 0);

/** Can this rack tile be played as this letter (without using a blank)? */
export const tileCanBe = (tile: string, letter: string) => !isBlankTile(tile) && tileOptions(tile).includes(letter);

/** Removes one copy of each tile from a rack. Returns null if a tile isn't there. */
export function removeTiles(rack: readonly string[], tiles: readonly string[]): string[] | null {
  const out = [...rack];
  for (const tile of tiles) {
    const i = out.indexOf(tile);
    if (i === -1) return null;
    out.splice(i, 1);
  }
  return out;
}

/** How many of each tile are left, for the "tiles you haven't seen" panel. */
export function countTiles(tiles: readonly string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const t of tiles) counts.set(t, (counts.get(t) ?? 0) + 1);
  const order = Object.keys(INITIAL_LETTER_QUANTITIES);
  return [...counts.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
}

const VOWEL_TILES = 'ะาำเแโใไ';

/**
 * Order used to decide who starts (official rule): a blank beats everything, then ก to ฮ,
 * and vowel tiles come last. A dual tile counts as its better letter. Lower is better.
 */
export function startRank(tile: string): number {
  if (isBlankTile(tile)) return 0;
  return Math.min(
    ...tileOptions(tile).map((ch) => (VOWEL_TILES.includes(ch) ? 1000 + VOWEL_TILES.indexOf(ch) : ch.charCodeAt(0) - 0x0e00)),
  );
}
