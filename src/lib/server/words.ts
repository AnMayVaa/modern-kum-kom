import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getDb } from './mongo';
import { normalizeThai } from '@/lib/game/thai';

const TTL_MS = 6 * 60 * 60 * 1000;
let cache: { words: string[]; set: Set<string>; at: number } | null = null;
let pending: Promise<string[]> | null = null;

async function fetchWords(): Promise<string[]> {
  const db = await getDb();
  if (db) {
    const docs = await db
      .collection<{ word: string }>('vocabulary')
      .find({}, { projection: { _id: 0, word: 1 } })
      .toArray();
    return docs.map((d) => d.word);
  }
  // Local development without MongoDB: use the list made by scripts/extract_word.py.
  const file = path.join(process.cwd(), 'src', 'lib', 'word_list.json');
  return JSON.parse(await readFile(file, 'utf8')) as string[];
}

/** Every dictionary word in normal form, cached in memory for a few hours. */
export async function loadWords(): Promise<string[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.words;
  pending ??= fetchWords()
    .then((raw) => {
      const set = new Set<string>();
      for (const w of raw) if (typeof w === 'string' && w.trim()) set.add(normalizeThai(w.trim()));
      const words = [...set].sort((a, b) => a.localeCompare(b, 'th'));
      cache = { words, set, at: Date.now() };
      return words;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

export async function isWord(word: string): Promise<boolean> {
  await loadWords();
  return cache!.set.has(normalizeThai(word));
}
