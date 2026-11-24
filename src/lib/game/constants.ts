// Board, tile and rule constants for Kum-Kom (คำคม).
//
// The play grid is 31 rows × 15 columns. Odd rows (1, 3, … 29) are the 15 real board
// rows where letter tiles go. Even rows (0, 2, … 30) are thin "mark" rows between them
// that hold the free upper/lower vowels and tone marks of the letter above or below.

export type Premium = '2L' | '3L' | '4L' | '2W' | '3W' | 'STAR' | null;

export const BOARD_SIZE = 15;
export const GRID_ROWS = BOARD_SIZE * 2 + 1;
export const RACK_SIZE = 9;
export const STAR = { r: 15, c: 7 } as const;
export const STALEMATE_LIMIT = 6;

export const BOARD_LAYOUT: Premium[][] = [
  ['3W', null, null, '2L', null, null, null, '3W', null, null, null, '2L', null, null, '3W'],
  [null, '2W', null, null, null, '3L', null, null, null, '3L', null, null, null, '2W', null],
  [null, null, '2W', null, null, null, '2L', null, '2L', null, null, null, '2W', null, null],
  ['2L', null, null, '2W', null, null, null, '4L', null, null, null, '2W', null, null, '2L'],
  [null, null, null, null, '2W', null, null, null, null, null, '2W', null, null, null, null],
  [null, '3L', null, null, null, '3L', null, null, null, '3L', null, null, null, '3L', null],
  [null, null, '2L', null, null, null, '2L', null, '2L', null, null, null, '2L', null, null],
  ['3W', null, null, '2L', null, null, null, 'STAR', null, null, null, '2L', null, null, '3W'],
  [null, null, '2L', null, null, null, '2L', null, '2L', null, null, null, '2L', null, null],
  [null, '3L', null, null, null, '3L', null, null, null, '3L', null, null, null, '3L', null],
  [null, null, null, null, '2W', null, null, null, null, null, '2W', null, null, null, null],
  ['2L', null, null, '2W', null, null, null, '4L', null, null, null, '2W', null, null, '2L'],
  [null, null, '2W', null, null, null, '2L', null, '2L', null, null, null, '2W', null, null],
  [null, '2W', null, null, null, '3L', null, null, null, '3L', null, null, null, '2W', null],
  ['3W', null, null, '2L', null, null, null, '3W', null, null, null, '2L', null, null, '3W'],
];

export const LETTER_SCORES: Record<string, number> = {
  'ก': 1, 'ข': 3, 'ค': 2, 'ฆ': 6, 'ง': 1, 'จ': 2, 'ฉ': 6, 'ช': 3, 'ซ': 6, 'ฌ': 8,
  'ญ': 8, 'ฎ': 7, 'ฏ': 7, 'ฐ': 6, 'ฑ': 6, 'ฒ': 7, 'ณ': 7, 'ด': 1, 'ต': 3, 'ถ': 4,
  'ท': 2, 'ธ': 5, 'น': 1, 'บ': 1, 'ป': 3, 'ผ': 3, 'ฝ': 4, 'พ': 3, 'ฟ': 4, 'ภ': 7,
  'ม': 1, 'ย': 1, 'ร': 1, 'ฤ': 6, 'ล': 1, 'ว': 1, 'ศ': 6, 'ษ': 8, 'ส': 3, 'ห': 4,
  'ฬ': 8, 'อ': 1, 'ฮ': 6, 'ฦ': 6, 'า': 1, 'ำ': 2, 'เ': 1, 'แ': 2, 'ไ': 2, 'ใ': 2,
  'โ': 2, 'ะ': 1, '0': 0, 'ๅ': 0,
};

/** Tiles in the bag at the start of a game. "ฆ/ซ" is one dual tile that plays as either letter; "0" is a blank. */
export const INITIAL_LETTER_QUANTITIES: Record<string, number> = {
  'ก': 4, 'ข': 2, 'ค': 2, 'ฆ/ซ': 1, 'ง': 3, 'จ': 2, 'ฉ': 1, 'ช': 2, 'ฌ/ษ': 1,
  'ฎ/ฏ': 1, 'ฐ/ฑ': 1, 'ฒ/ณ': 1, 'ด': 3, 'ต': 2, 'ถ': 1, 'ท': 2, 'ธ': 1, 'น': 3,
  'บ': 3, 'ป': 2, 'ผ': 1, 'ฝ': 1, 'พ': 2, 'ฟ': 2, 'ภ': 1, 'ม': 3, 'ย': 3, 'ร': 3,
  'ล': 3, 'ว': 3, 'ศ/ฤ': 1, 'ส': 3, 'ห': 2, 'ฬ/ญ': 1, 'อ': 3, 'ฮ/ฦ': 1, 'า': 5,
  'ำ': 2, 'เ': 5, 'แ': 4, 'ไ': 2, 'ใ': 2, 'โ': 3, 'ะ': 6, '0': 4,
};

export const BLANK = '0';

/** Letters a blank tile can stand for. */
export const BLANK_CHOICES = 'กขคฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮฤฦาำเแไใโะๅ'.split('');

/** Characters that sit on a letter square. */
export const MAIN_CHARS = new Set(BLANK_CHOICES);

/** Free marks: unlimited, worth nothing, placed in the thin rows. */
export const UPPER_VOWELS = ['ั', 'ิ', 'ี', 'ึ', 'ื', '็'];
export const TOP_MARKS = ['่', '้', '๊', '๋', '์', 'ํ'];
export const LOWER_VOWELS = ['ุ', 'ู'];

export const BINGO_BONUS: Record<number, number> = { 6: 40, 7: 50, 8: 70, 9: 90 };

export const PREMIUM_LABELS: Record<Exclude<Premium, null>, string> = {
  '2L': 'อักษร ×2',
  '3L': 'อักษร ×3',
  '4L': 'อักษร ×4',
  '2W': 'คำ ×2',
  '3W': 'คำ ×3',
  STAR: 'ดาว (คำ ×2)',
};
