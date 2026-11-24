import bundled from '@/data/words.json';
import { normalizeThai } from '@/lib/game/thai';

// The dictionary ships with the app (src/data/words.json, made by scripts/extract_word.py),
// so word checks never depend on a database being up.
let cache: { words: string[]; set: Set<string> } | null = null;

function build() {
  const set = new Set<string>();
  for (const w of bundled as string[]) if (w.trim()) set.add(normalizeThai(w.trim()));
  const words = [...set].sort((a, b) => a.localeCompare(b, 'th'));
  return { words, set };
}

/** Every dictionary word in normal form. */
export async function loadWords(): Promise<string[]> {
  cache ??= build();
  return cache.words;
}

export async function isWord(word: string): Promise<boolean> {
  cache ??= build();
  return cache.set.has(normalizeThai(word));
}
