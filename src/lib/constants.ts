export const FREE_DIACRITICS = ['ิ', 'ี', 'ึ', 'ื', 'ุ', 'ู', '่', '้', '๊', '๋', '็', '์', 'ั'];
export const THAI_CONSONANTS = "กขคฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ".split("");

export const BOARD_LAYOUT = [
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
  ['3W', null, null, '2L', null, null, null, '3W', null, null, null, '2L', null, null, '3W']
];

export const LETTER_SCORES: Record<string, number> = {
  'ก':1, 'ข':3, 'ค':2, 'ฆ':6, 'ซ':6, 'ง':1, 'จ':2, 'ฉ':6, 'ช':3, 'ฌ':8, 'ษ':8, 'ฎ':7, 'ฏ':7, 'ฐ':6, 'ฑ':6, 'ฒ':7, 'ณ':7, 'ด':1, 'ต':3, 'ถ':4,
  'ท':2, 'ธ':5, 'น':1, 'บ':1, 'ป':3, 'ผ':3, 'ฝ':4, 'พ':3, 'ฟ':4, 'ภ':7, 'ม':1, 'ย':1, 'ร':1, 'ล':1, 'ว':1,
  'ศ':6, 'ฤ':6, 'ส':3, 'ห':4, 'ฬ':8, 'ญ':8, 'อ':1, 'ฮ':6, 'า':1, 'ำ':2, 'เ':1, 'แ':2, 'ไ':2, 'ใ':2, 'โ':2, 'ะ':1, '0':0
};

export const INITIAL_LETTER_QUANTITIES: Record<string, number> = {
  'ก':4, 'ข':2, 'ค':2, 'ง':3, 'จ':2, 'ฉ':1, 'ช':2, 'ด':3, 'ต':2, 'ถ':1,
  'ท':2, 'ธ':1, 'น':3, 'บ':3, 'ป':2, 'ผ':1, 'ฝ':1, 'พ':2, 'ฟ':2, 'ภ':1,
  'ม':3, 'ย':3, 'ร':3, 'ล':3, 'ว':3, 'ส':3, 'ห':2, 'อ':3, 'า':5, 'เ':5, 
  'แ':4, 'ไ':2, 'ใ':2, 'โ':3, 'ะ':6, '0':4
};