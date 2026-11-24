import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getDb } from './mongo';
import { normalizeThai } from '@/lib/game/thai';

const TTL_MS = 6 * 60 * 60 * 1000;
let cache: { words: string[]; set: Set<string>; at: number } | null = null;
let pending: Promise<string[]> | null = null;

// The list made by scripts/extract_word.py, used when there is no database (local development).
const readLocalList = async () =>
  JSON.parse(await readFile(path.join(process.cwd(), 'src', 'lib', 'word_list.json'), 'utf8')) as string[];

async function fetchWords(): Promise<string[]> {
  let db;
  try {
    db = await getDb();
  } catch (error) {
    return readLocalList().catch(() => {
      throw error;
    });
  }
  if (!db) return readLocalList();
  const docs = await db
    .collection<{ word: string }>('vocabulary')
    .find({}, { projection: { _id: 0, word: 1 } })
    .toArray();
  return docs.map((d) => d.word);
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
