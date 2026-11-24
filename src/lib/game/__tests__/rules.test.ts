import { describe, expect, it } from 'vitest';
import { createGrid, clusterAt, Grid } from '../board';
import { evaluateMove, findWords, Placement } from '../rules';
import { normalizeThai, parseWord } from '../thai';
import { Dictionary } from '../dictionary';

const dict = new Dictionary(['กา', 'การ', 'กาด', 'ปุ่ม', 'ที่', 'กิน', 'นก', 'ดี', 'ดีด', 'ไม่', 'กด', 'ดาว', 'ราว']);
const tile = (r: number, c: number, char: string, extra: Partial<Placement> = {}): Placement => ({ r, c, char, ...extra });

function withWord(grid: Grid, r: number, c: number, letters: string) {
  [...letters].forEach((ch, i) => (grid[r][c + i] = ch));
  return grid;
}

describe('Thai text', () => {
  it('puts marks in typing order whatever order they were placed in', () => {
    expect(normalizeThai('ปุ่ม')).toBe('ปุ่ม');
    expect(normalizeThai('ท่ี')).toBe('ที่');
  });

  it('splits words into letter tiles with stacked marks', () => {
    expect(parseWord('ที่')).toEqual([{ base: 'ท', upper: 'ี่', lower: '' }]);
    expect(parseWord('ปุ่ม')).toEqual([
      { base: 'ป', upper: '่', lower: 'ุ' },
      { base: 'ม', upper: '', lower: '' },
    ]);
    expect(parseWord('ไม่')?.map((c) => c.base).join('')).toBe('ไม');
    expect(parseWord('abc')).toBeNull();
  });

  it('reads a letter with marks above and below it', () => {
    const g = createGrid();
    g[15][7] = 'ป';
    g[16][7] = 'ุ';
    g[14][7] = '่';
    g[15][8] = 'ม';
    expect(clusterAt(g, 15, 7)).toBe('ปุ่');
    expect(findWords(g, [{ r: 15, c: 7 }]).map((w) => w.text)).toEqual(['ปุ่ม']);
  });

  it('assigns a mark between two vertical letters to the right letter', () => {
    const g = createGrid();
    g[13][7] = 'ด';
    g[15][7] = 'ก';
    g[14][7] = 'ิ'; // upper vowel sits on the lower letter (ก)
    g[17][7] = 'น';
    expect(findWords(g, [{ r: 15, c: 7 }]).map((w) => w.text)).toEqual(['ดกิน']);
  });
});

describe('placement rules', () => {
  it('requires the first word to cross the star', () => {
    const e = evaluateMove(createGrid(), new Set(), [tile(1, 0, 'ก'), tile(1, 1, 'า')]);
    expect(e.error).toMatch('ดาว');
    const ok = evaluateMove(createGrid(), new Set(), [tile(15, 7, 'ก'), tile(15, 8, 'า')], dict.has);
    expect(ok.ok).toBe(true);
    expect(ok.words.map((w) => w.text)).toEqual(['กา']);
  });

  it('rejects tiles that are not in one line, have gaps, or float away from the board', () => {
    const g = withWord(createGrid(), 15, 7, 'กา');
    expect(evaluateMove(g, new Set(), [tile(17, 7, 'ด'), tile(19, 8, 'น')]).error).toMatch('แถวเดียว');
    expect(evaluateMove(g, new Set(), [tile(15, 10, 'ร'), tile(15, 12, 'ด')]).error).toMatch('เว้นช่อง');
    expect(evaluateMove(g, new Set(), [tile(1, 0, 'ก'), tile(1, 1, 'า')]).error).toMatch('ต่อกับคำ');
  });

  it('keeps every earlier word on the board after a crossing move', () => {
    const g = withWord(createGrid(), 15, 6, 'การ');
    const e = evaluateMove(g, new Set(), [tile(17, 6, 'ด')], dict.has);
    expect(e.words.map((w) => w.text)).toEqual(['กด']);
    expect(e.ok).toBe(true);
    expect(e.grid[15].slice(6, 9)).toEqual(['ก', 'า', 'ร']);
  });

  it('flags words that are not in the dictionary', () => {
    const g = withWord(createGrid(), 15, 6, 'การ');
    const e = evaluateMove(g, new Set(), [tile(17, 7, 'ก')], dict.has);
    expect(e.error).toBeNull();
    expect(e.ok).toBe(false);
    expect(e.invalidWords).toEqual(['าก']);
  });

  it('allows free marks only on the word being played', () => {
    const g = withWord(createGrid(), 15, 7, 'กา');
    g[15][3] = 'ด';
    // ด at (15,3) is unrelated, so a mark above it is refused
    const away = evaluateMove(g, new Set(), [tile(17, 7, 'ด'), tile(14, 3, 'ี')]);
    expect(away.error).toMatch('คำที่กำลังลง');
    // marks alone are not a move
    expect(evaluateMove(g, new Set(), [tile(14, 7, 'ิ')]).error).toMatch('อย่างน้อย 1 ตัว');
  });

  it('builds words with marks and rejects impossible stacks', () => {
    const g = createGrid();
    const e = evaluateMove(g, new Set(), [tile(15, 7, 'ด'), tile(14, 7, 'ี'), tile(15, 8, 'ด')], dict.has);
    expect(e.words.map((w) => w.text)).toEqual(['ดีด']);
    expect(e.ok).toBe(true);
    expect(evaluateMove(g, new Set(), [tile(15, 7, 'ด'), tile(14, 7, 'ีี')]).error).toMatch('ซ้อนกัน');
  });

  it('refuses to replace marks that are already on the board', () => {
    const g = createGrid();
    g[15][7] = 'ด';
    g[14][7] = 'ี';
    g[15][8] = 'ด';
    const e = evaluateMove(g, new Set(), [tile(15, 9, 'ก'), tile(14, 7, 'ิ')]);
    expect(e.error).toMatch('มีสระ');
  });
});

describe('scoring', () => {
  it('applies letter and word premiums only to new tiles, and blanks score zero', () => {
    // (15,7) is the star (word ×2). ก=1, า=1.
    const first = evaluateMove(createGrid(), new Set(), [tile(15, 7, 'ก'), tile(15, 8, 'า'), tile(15, 9, 'ร')], dict.has);
    expect(first.total).toBe((1 + 1 + 1) * 2);

    const blank = evaluateMove(createGrid(), new Set(), [tile(15, 7, 'ข', { isBlank: true }), tile(15, 8, 'า')]);
    expect(blank.words[0].letterPoints).toBe(1);

    // (15,11) is a 2L square; ร=1 so "การ" played to it = 1+1+1×2
    const g = withWord(createGrid(), 15, 9, 'กา');
    const e = evaluateMove(g, new Set(), [tile(15, 11, 'ร')], dict.has);
    expect(e.words[0].detail).toBe('1 + 1 + 1×2 = 4');
  });

  it('adds the bingo bonus for 6 or more tiles', () => {
    const tiles = [...'กกกกกก'].map((ch, i) => tile(15, 4 + i, ch));
    expect(evaluateMove(createGrid(), new Set(), tiles).bingo).toBe(40);
  });
});
