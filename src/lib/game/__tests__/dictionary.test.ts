import { describe, expect, it } from 'vitest';
import words from '@/data/words.json';
import { Dictionary } from '../dictionary';
import { generateMoves } from '../bot';
import { createGrid } from '../board';

describe('bundled dictionary', () => {
  const dict = new Dictionary(words as string[]);

  it('loads the Kum-Kom word list', () => {
    expect(dict.size).toBeGreaterThan(25_000);
    for (const w of ['กิน', 'ที่', 'ปุ่ม', 'น้ำ', 'ไม่', 'เกี่ยว']) expect(dict.has(w)).toBe(true);
    expect(dict.has('กขคง')).toBe(false);
  });

  it('gives the bot real opening moves', () => {
    const moves = generateMoves(createGrid(), [], ['ก', 'า', 'ร', 'น', 'ม', 'ด', 'เ', 'ป', 'ล'], dict);
    expect(moves.length).toBeGreaterThan(20);
    expect(moves.every((m) => m.words.every((w) => dict.has(w.text)))).toBe(true);
  });
});
