// Board, tile and rule constants for Kum-Kom (คำคม), following the official board and
// rule sheet (กฎกติกาการเล่นเกม เริ่มใช้ ตุลาคม 2552).
//
// The board has 15 columns and 9 letter rows. The play grid is 19 rows × 15 columns: odd
// rows (1, 3, … 17) are the letter rows, and the even rows (0, 2, … 18) are the thin
// "mark" rows above and below them that hold the free vowels and tone marks.

export type Premium = '2L' | '3L' | '4L' | '5L' | '2W' | '3W' | 'STAR' | null;

export const BOARD_COLS = 15;
export const BOARD_ROWS = 9;
export const GRID_ROWS = BOARD_ROWS * 2 + 1;
export const RACK_SIZE = 9;
/** The centre star, in grid coordinates (board row 5 of 9, column 8 of 15). */
export const STAR = { r: 9, c: 7 } as const;
export const STALEMATE_LIMIT = 6;
/** Tiles may only be exchanged while at least this many are left in the bag. */
export const MIN_BAG_TO_EXCHANGE = 9;

// Red 3W = 3× word, pink 2W = 2× word, purple 5L / orange 4L / green 3L / light blue 2L
// = 5×/4×/3×/2× letter. The layout is symmetric under a half turn.
export const BOARD_LAYOUT: Premium[][] = [
  ['3W', null, null, null, '2L', null, null, '3L', null, null, '2L', null, null, null, '3W'],
  [null, '2W', null, null, null, null, '3L', null, '3L', null, null, null, null, '2W', null],
  [null, null, '5L', null, null, '4L', null, null, null, '5L', null, null, '4L', null, null],
  [null, null, null, '4L', null, null, '3L', null, '4L', null, null, '3L', null, null, null],
  ['3L', null, null, null, '3L', null, null, 'STAR', null, null, '3L', null, null, null, '3L'],
  [null, null, null, '3L', null, null, '4L', null, '3L', null, null, '4L', null, null, null],
  [null, null, '4L', null, null, '5L', null, null, null, '4L', null, null, '5L', null, null],
  [null, '2W', null, null, null, null, '3L', null, '3L', null, null, null, null, '2W', null],
  ['3W', null, null, null, '2L', null, null, '3L', null, null, '2L', null, null, null, '3W'],
];

export const LETTER_SCORES: Record<string, number> = {
  'ก': 1, 'ข': 3, 'ค': 2, 'ฆ': 6, 'ง': 1, 'จ': 2, 'ฉ': 6, 'ช': 3, 'ซ': 6, 'ฌ': 8,
  'ญ': 8, 'ฎ': 7, 'ฏ': 7, 'ฐ': 6, 'ฑ': 6, 'ฒ': 7, 'ณ': 7, 'ด': 1, 'ต': 3, 'ถ': 4,
  'ท': 2, 'ธ': 5, 'น': 1, 'บ': 1, 'ป': 3, 'ผ': 3, 'ฝ': 4, 'พ': 3, 'ฟ': 4, 'ภ': 7,
  'ม': 1, 'ย': 1, 'ร': 1, 'ฤ': 6, 'ล': 1, 'ว': 1, 'ศ': 6, 'ษ': 8, 'ส': 3, 'ห': 4,
  'ฬ': 8, 'อ': 1, 'ฮ': 6, 'ฦ': 6, 'า': 1, 'ำ': 2, 'เ': 1, 'แ': 2, 'ไ': 2, 'ใ': 2,
  'โ': 2, 'ะ': 1, '0': 0, 'ๅ': 0,
};

/** The 104 tiles in the bag at the start of a game. "ฆ/ซ" is one dual tile that plays as either letter; "0" is a blank. */
export const INITIAL_LETTER_QUANTITIES: Record<string, number> = {
  'ก': 4, 'ข': 2, 'ค': 2, 'ฆ/ซ': 1, 'ง': 3, 'จ': 2, 'ฉ': 1, 'ช': 2, 'ฌ/ษ': 1,
  'ฎ/ฏ': 1, 'ฐ/ฑ': 1, 'ฒ/ณ': 1, 'ด': 3, 'ต': 2, 'ถ': 1, 'ท': 2, 'ธ': 1, 'น': 3,
  'บ': 3, 'ป': 2, 'ผ': 1, 'ฝ': 1, 'พ': 2, 'ฟ': 2, 'ภ': 1, 'ม': 3, 'ย': 3, 'ร': 3,
  'ล': 3, 'ว': 3, 'ศ/ฤ': 1, 'ส': 3, 'ห': 2, 'ฬ/ญ': 1, 'อ': 3, 'ฮ/ฦ': 1, 'า': 5,
  'ำ': 2, 'เ': 5, 'แ': 4, 'ไ': 2, 'ใ': 2, 'โ': 3, 'ะ': 6, '0': 4,
};

export const BLANK = '0';

/** Letters a blank tile can stand for (ๅ only exists as a blank, for ฤๅ and ฦๅ). */
export const BLANK_CHOICES = 'กขคฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮฤฦาำเแไใโะๅ'.split('');

/** Characters that sit on a letter square. */
export const MAIN_CHARS = new Set(BLANK_CHOICES);

/** Free marks: unlimited, worth nothing, placed in the thin rows. */
export const UPPER_VOWELS = ['ั', 'ิ', 'ี', 'ึ', 'ื', '็'];
export const TOP_MARKS = ['่', '้', '๊', '๋', '์'];
export const LOWER_VOWELS = ['ุ', 'ู'];

export const BINGO_BONUS: Record<number, number> = { 6: 40, 7: 50, 8: 70, 9: 90 };

export const PREMIUM_LABELS: Record<Exclude<Premium, null>, string> = {
  '2L': '2 เท่าของตัวอักษร',
  '3L': '3 เท่าของตัวอักษร',
  '4L': '4 เท่าของตัวอักษร',
  '5L': '5 เท่าของตัวอักษร',
  '2W': '2 เท่าของคำ',
  '3W': '3 เท่าของคำ',
  STAR: 'ช่องดาว 2 เท่าของคำ',
};
