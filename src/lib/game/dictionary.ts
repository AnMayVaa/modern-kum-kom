// In-memory dictionary. The full word list (~26k words) is small enough to load once in
// the browser, which makes word checks instant and lets the bot search every word.

import { BOARD_SIZE } from './constants';
import { normalizeThai, parseWord, WordCell } from './thai';

export interface DictEntry {
  text: string;
  cells: WordCell[];
}

export class Dictionary {
  private readonly set: Set<string>;
  /** Sorted, normalised words. */
  readonly list: string[];
  private parsed: DictEntry[] | null = null;
  private positions: Map<string, number[]> | null = null;

  constructor(words: Iterable<string>) {
    const set = new Set<string>();
    for (const raw of words) {
      const w = typeof raw === 'string' ? normalizeThai(raw.trim()) : '';
      if (w) set.add(w);
    }
    this.set = set;
    this.list = [...set].sort((a, b) => a.localeCompare(b, 'th'));
  }

  get size() {
    return this.set.size;
  }

  has = (word: string) => this.set.has(normalizeThai(word));

  /** Faster lookup for text that is already in normal form (words read off the board are). */
  hasNormalized = (word: string) => this.set.has(word);

  /** Words that can actually be built on the board (2–15 letter tiles), split into cells. */
  get entries(): DictEntry[] {
    if (!this.parsed) {
      const out: DictEntry[] = [];
      for (const text of this.list) {
        const cells = parseWord(text);
        if (cells && cells.length >= 2 && cells.length <= BOARD_SIZE) out.push({ text, cells });
      }
      this.parsed = out;
    }
    return this.parsed;
  }

  /** Entry indexes by "length|offset|letter", so the bot can jump straight to words that fit a board pattern. */
  get positionIndex(): Map<string, number[]> {
    if (!this.positions) {
      const index = new Map<string, number[]>();
      this.entries.forEach((entry, i) => {
        const len = entry.cells.length;
        entry.cells.forEach((cell, offset) => {
          const key = `${len}|${offset}|${cell.base}`;
          const list = index.get(key);
          if (list) list.push(i);
          else index.set(key, [i]);
        });
      });
      this.positions = index;
    }
    return this.positions;
  }

  /** Words starting with the query first, then words containing it. */
  search(query: string, limit = 60): string[] {
    const q = normalizeThai(query.trim());
    if (!q) return [];
    const starts: string[] = [];
    const contains: string[] = [];
    for (const w of this.list) {
      if (w.startsWith(q)) starts.push(w);
      else if (contains.length < limit && w.includes(q)) contains.push(w);
      if (starts.length >= limit) break;
    }
    return [...starts, ...contains].slice(0, limit);
  }
}
