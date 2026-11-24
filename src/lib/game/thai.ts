// Thai text helpers: which characters are letters vs. free marks, how marks stack on a
// letter, and a normal form so that the same word always compares equal no matter in
// which order its marks were typed or placed.

import { LOWER_VOWELS, MAIN_CHARS, TOP_MARKS, UPPER_VOWELS } from './constants';

const LOWER = new Set(LOWER_VOWELS);
const UPPER_VOWEL = new Set(UPPER_VOWELS);
const TOP = new Set(TOP_MARKS);

export const isLowerMark = (ch: string) => LOWER.has(ch);
export const isUpperVowel = (ch: string) => UPPER_VOWEL.has(ch);
export const isTopMark = (ch: string) => TOP.has(ch);
export const isUpperMark = (ch: string) => UPPER_VOWEL.has(ch) || TOP.has(ch);
export const isMark = (ch: string) => isLowerMark(ch) || isUpperMark(ch);
export const isMainChar = (ch: string) => MAIN_CHARS.has(ch);

/** True if a mark cell's content is a lower vowel (it then belongs to the letter above it). */
export const isLowerContent = (content: string | null | undefined) =>
  !!content && [...content].some(isLowerMark);

// Vowel marks come first, then tone marks, then thanthakhat/nikhahit, which is the
// order Thai text is normally typed in (e.g. ป + ุ + ่ + ม = ปุ่ม).
const markRank = (ch: string) => (isLowerMark(ch) || isUpperVowel(ch) ? 0 : ch === '์' || ch === 'ํ' ? 2 : 1);

/** Sorts the marks after each letter into the canonical order. */
export function normalizeThai(text: string): string {
  const chars = [...text.normalize('NFC')];
  let out = '';
  let i = 0;
  while (i < chars.length) {
    out += chars[i];
    i++;
    const marks: string[] = [];
    while (i < chars.length && isMark(chars[i])) {
      marks.push(chars[i]);
      i++;
    }
    if (marks.length > 1) marks.sort((a, b) => markRank(a) - markRank(b));
    out += marks.join('');
  }
  return out;
}

export interface WordCell {
  base: string;
  /** Upper marks on this letter, e.g. "ี่". Empty when none. */
  upper: string;
  /** Lower vowel on this letter, e.g. "ุ". Empty when none. */
  lower: string;
}

/**
 * Splits a word into board cells: one letter tile each, with the marks that stack on it.
 * Returns null if the word can't be built on a Kum-Kom board (unknown characters, a mark
 * with no letter under it, or more marks than fit on one letter).
 */
export function parseWord(word: string): WordCell[] | null {
  const chars = [...normalizeThai(word)];
  const cells: WordCell[] = [];
  for (const ch of chars) {
    if (isMainChar(ch)) {
      cells.push({ base: ch, upper: '', lower: '' });
      continue;
    }
    const cell = cells[cells.length - 1];
    if (!cell || !isMark(ch)) return null;
    if (isLowerMark(ch)) {
      if (cell.lower) return null;
      cell.lower = ch;
    } else {
      const next = combineUpper(cell.upper, ch);
      if (next === null) return null;
      cell.upper = next;
    }
  }
  return cells.length ? cells : null;
}

/** Adds one upper mark to an upper cell: at most one vowel and one tone/top mark. */
export function combineUpper(current: string, mark: string): string | null {
  const chars = [...current];
  const vowel = chars.find(isUpperVowel) ?? '';
  const top = chars.find(isTopMark) ?? '';
  if (isUpperVowel(mark)) return vowel ? null : mark + top;
  if (isTopMark(mark)) return top ? null : vowel + mark;
  return null;
}

/** The text a letter reads as once its marks are attached. */
export function clusterText(base: string, upper: string, lower: string): string {
  return normalizeThai(base + lower + upper);
}

/** Is this a valid set of marks for one mark cell? */
export function isValidMarkContent(content: string): boolean {
  const chars = [...content];
  if (chars.length === 0) return false;
  if (chars.every(isLowerMark)) return chars.length === 1;
  if (!chars.every(isUpperMark)) return false;
  let acc = '';
  for (const ch of chars) {
    const next = combineUpper(acc, ch);
    if (next === null) return false;
    acc = next;
  }
  return true;
}
