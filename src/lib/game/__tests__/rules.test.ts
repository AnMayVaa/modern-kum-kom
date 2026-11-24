import { describe, expect, it } from 'vitest';
import { createGrid, clusterAt, Grid } from '../board';
import { BOARD_LAYOUT, STAR } from '../constants';
import { evaluateMove, findWords, keepOnlyWords, Placement } from '../rules';
import { normalizeThai, parseWord } from '../thai';
import { Dictionary } from '../dictionary';

const R = STAR.r; // the star's row in grid coordinates (9)
const dict = new Dictionary(['กา', 'การ', 'กาด', 'ปุ่ม', 'ที่', 'กิน', 'นก', 'ดี', 'ดีด', 'ไม่', 'กด', 'ดาว', 'ราว', 'หลง', 'หาง', 'พาย', 'ต่ำ', 'เนรมิต', 'ผกา', 'ผอม']);
const tile = (r: number, c: number, char: string, extra: Partial<Placement> = {}): Placement => ({ r, c, char, ...extra });

function withWord(grid: Grid, r: number, c: number, letters: string) {
  [...letters].forEach((ch, i) => (grid[r][c + i] = ch));
  return grid;
}

describe('official board', () => {
  it('has 9 rows of 15 squares with the star in the middle and 5× letter squares', () => {
    expect(BOARD_LAYOUT).toHaveLength(9);
    BOARD_LAYOUT.forEach((row) => expect(row).toHaveLength(15));
    expect(BOARD_LAYOUT[4][7]).toBe('STAR');
    expect(BOARD_LAYOUT.flat().filter((p) => p === '5L')).toHaveLength(4);
    // symmetric under a half turn, like the printed board
    BOARD_LAYOUT.forEach((row, r) => row.forEach((p, c) => expect(BOARD_LAYOUT[8 - r][14 - c]).toBe(p)));
  });
});

describe('Thai text', () => {
  it('puts marks in typing order whatever order they were placed in', () => {
    expect(normalizeThai('ปุ่ม')).toBe('ปุ่ม');
    expect(normalizeThai('ท่ี')).toBe('ที่');
  });

  it('splits words into letter tiles with stacked marks', () => {
    expect(parseWord('ที่')).toEqual([{ base: 'ท', upper: 'ี่', lower: '' }]);
    expect(parseWord('ปุ่ม')).toEqual([
      { base: 'ป', upper: '่', lower: 'ุ' },
      { base: 'ม', upper: '', lower: '' },
    ]);
    expect(parseWord('abc')).toBeNull();
  });

  it('puts the tone of ต่ำ above the ำ tile, as the rule sheet says', () => {
    expect(parseWord('ต่ำ')).toEqual([
      { base: 'ต', upper: '', lower: '' },
      { base: 'ำ', upper: '่', lower: '' },
    ]);
    const g = createGrid();
    g[R][7] = 'ต';
    g[R][8] = 'ำ';
    g[R - 1][8] = '่';
    expect(findWords(g, [{ r: R, c: 7 }]).map((w) => w.text)).toEqual(['ต่ำ']);
    expect(dict.has(findWords(g, [{ r: R, c: 7 }])[0].text)).toBe(true);
  });

  it('reads a letter with marks above and below it', () => {
    const g = createGrid();
    g[R][7] = 'ป';
    g[R + 1][7] = 'ุ';
    g[R - 1][7] = '่';
    g[R][8] = 'ม';
    expect(clusterAt(g, R, 7)).toBe('ปุ่');
    expect(findWords(g, [{ r: R, c: 7 }]).map((w) => w.text)).toEqual(['ปุ่ม']);
  });

  it('gives a mark between two vertical letters to the right letter', () => {
    const g = createGrid();
    g[R - 2][7] = 'ด';
    g[R][7] = 'ก';
    g[R - 1][7] = 'ิ'; // an upper vowel belongs to the letter below it
    g[R + 2][7] = 'น';
    expect(findWords(g, [{ r: R, c: 7 }]).map((w) => w.text)).toEqual(['ดกิน']);
  });
});

describe('placement rules', () => {
  it('requires the first word to cross the star', () => {
    expect(evaluateMove(createGrid(), new Set(), [tile(1, 0, 'ก'), tile(1, 1, 'า')]).error).toMatch('ดาว');
    const ok = evaluateMove(createGrid(), new Set(), [tile(R, 7, 'ก'), tile(R, 8, 'า')], dict.has);
    expect(ok.ok).toBe(true);
  });

  it('rejects tiles that are not in one line, leave gaps, or float away from the board', () => {
    const g = withWord(createGrid(), R, 7, 'กา');
    expect(evaluateMove(g, new Set(), [tile(R + 2, 7, 'ด'), tile(R + 4, 8, 'น')]).error).toMatch('แถวเดียว');
    expect(evaluateMove(g, new Set(), [tile(R, 10, 'ร'), tile(R, 12, 'ด')]).error).toMatch('เว้นช่อง');
    expect(evaluateMove(g, new Set(), [tile(1, 0, 'ก'), tile(1, 1, 'า')]).error).toMatch('ต่อกับคำ');
  });

  it('flags words that are not in the dictionary', () => {
    const g = withWord(createGrid(), R, 6, 'การ');
    const e = evaluateMove(g, new Set(), [tile(R + 2, 7, 'ก')], dict.has);
    expect(e.error).toBeNull();
    expect(e.invalidWords).toEqual(['าก']);
  });

  it('allows free marks only on the word being played, and not on their own', () => {
    const g = withWord(createGrid(), R, 7, 'กา');
    g[R][3] = 'ด';
    expect(evaluateMove(g, new Set(), [tile(R + 2, 7, 'ด'), tile(R - 1, 3, 'ี')]).error).toMatch('คำที่กำลังลง');
    expect(evaluateMove(g, new Set(), [tile(R - 1, 7, 'ิ')]).error).toMatch('อย่างน้อย 1 ตัว');
  });

  it('refuses to change marks of letters that are not being replaced', () => {
    const g = createGrid();
    g[R][7] = 'ด';
    g[R - 1][7] = 'ี';
    g[R][8] = 'ด';
    expect(evaluateMove(g, new Set(), [tile(R, 9, 'ก'), tile(R - 1, 7, 'ิ')]).error).toMatch('มีสระ');
    expect(evaluateMove(g, new Set(), [tile(R, 9, 'ก'), tile(R - 1, 7, '')]).error).toMatch('ถูกแทนที่');
  });
});

describe('replacing a letter (แทนที่ตัวอักษร)', () => {
  // หลง on the board; put า over ล and play พาย downwards: หลง becomes หาง.
  const board = () => withWord(createGrid(), R, 6, 'หลง');

  it('scores both the changed word and the new word', () => {
    const e = evaluateMove(board(), new Set(), [tile(R - 2, 7, 'พ'), tile(R, 7, 'า'), tile(R + 2, 7, 'ย')], dict.has);
    expect(e.ok).toBe(true);
    expect(e.words.map((w) => w.text).sort()).toEqual(['พาย', 'หาง']);
  });

  it('must use a different letter', () => {
    expect(evaluateMove(board(), new Set(), [tile(R - 2, 7, 'พ'), tile(R, 7, 'ล')]).error).toMatch('ไม่ซ้ำ');
  });

  it('must continue in the opposite direction', () => {
    expect(evaluateMove(board(), new Set(), [tile(R, 7, 'า')]).error).toMatch('แนวตรงข้าม');
    expect(evaluateMove(board(), new Set(), [tile(R, 7, 'า'), tile(R, 9, 'ก')]).error).toMatch('แนวตรงข้าม');
  });

  it('may take off the marks of the replaced letter (ฎีกา → ผกา + ผอม)', () => {
    const g = withWord(createGrid(), R, 7, 'ฎกา');
    g[R - 1][7] = 'ี';
    const e = evaluateMove(g, new Set(), [tile(R, 7, 'ผ'), tile(R - 1, 7, ''), tile(R + 2, 7, 'อ'), tile(R + 4, 7, 'ม')], dict.has);
    expect(e.ok).toBe(true);
    expect(e.words.map((w) => w.text).sort()).toEqual(['ผกา', 'ผอม']);
  });
});

describe('scoring', () => {
  it('matches the rule sheet example: เนรมิต with น on 3× letter and ต on the 2× word star = 18', () => {
    // row 5 has 3× letter at column 5 and the star at column 8 (counting from 1)
    const placements = [tile(R, 3, 'เ'), tile(R, 4, 'น'), tile(R, 5, 'ร'), tile(R, 6, 'ม'), tile(R - 1, 6, 'ิ'), tile(R, 7, 'ต')];
    const e = evaluateMove(createGrid(), new Set(), placements, dict.has);
    expect(e.ok).toBe(true);
    expect(e.words[0].text).toBe('เนรมิต');
    expect(e.total).toBe(18);
  });

  it('applies 5× letter squares and makes blanks worth nothing', () => {
    // (row 3, column 3) is a purple 5× letter square: ก(1×5) + า(1) + ร(1) = 7
    const e = evaluateMove(withWord(createGrid(), 5, 3, 'าร'), new Set(), [tile(5, 2, 'ก')], dict.has);
    expect(e.words[0].text).toBe('การ');
    expect(e.total).toBe(7);
    const first = evaluateMove(createGrid(), new Set(), [tile(R, 7, 'ข', { isBlank: true }), tile(R, 8, 'า')]);
    expect(first.words[0].letterPoints).toBe(1);
  });

  it('adds the bingo bonus for 6 or more tiles', () => {
    const tiles = [...'กกกกกก'].map((ch, i) => tile(R, 4 + i, ch));
    expect(evaluateMove(createGrid(), new Set(), tiles).bingo).toBe(40);
  });
});

describe('only the newest words stay on the board', () => {
  it('removes earlier words after a play (rule: นำคำที่เกิดขึ้นจากผู้เล่นคนแรกออก)', () => {
    // ดารา, then ป above ร and อ ท below make ปรอท; only ปรอท stays
    const g = withWord(createGrid(), R, 5, 'ดารา');
    g[R - 1][5] = null;
    const e = evaluateMove(g, new Set(), [tile(R - 2, 7, 'ป'), tile(R + 2, 7, 'อ'), tile(R + 4, 7, 'ท')]);
    const kept = keepOnlyWords(e.grid, e.blanks, e.words);
    const letters = kept.grid.flatMap((row, r) => row.map((ch, c) => (ch ? `${r},${c}` : null))).filter(Boolean);
    expect(letters.sort()).toEqual([`${R - 2},7`, `${R + 2},7`, `${R + 4},7`, `${R},7`].sort());
  });
});
