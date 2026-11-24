'use client';

import { Dictionary } from '@/lib/game/dictionary';
import { generateMoves, CandidateMove } from '@/lib/game/bot';
import type { Grid } from '@/lib/game/board';

let dictionary: Dictionary | null = null;
let loading: Promise<Dictionary> | null = null;
let worker: Worker | null = null;
let workerReady: Promise<boolean> | null = null;
let requestId = 0;
const waiting = new Map<number, (moves: CandidateMove[]) => void>();

export const getLoadedDictionary = () => dictionary;

/** Downloads the word list once per page load (the browser caches the response too). */
export function loadDictionary(): Promise<Dictionary> {
  if (dictionary) return Promise.resolve(dictionary);
  loading ??= fetch('/api/words')
    .then(async (res) => {
      if (!res.ok) throw new Error(`Word list request failed (${res.status})`);
      const { words } = (await res.json()) as { words: string[] };
      dictionary = new Dictionary(words);
      startWorker(words);
      return dictionary;
    })
    .catch((error) => {
      loading = null;
      throw error;
    });
  return loading;
}

function startWorker(words: string[]) {
  if (typeof Worker === 'undefined') return;
  try {
    worker = new Worker(new URL('../game/bot.worker.ts', import.meta.url));
  } catch {
    worker = null;
    return;
  }
  workerReady = new Promise<boolean>((resolve) => {
    const w = worker!;
    const fail = () => {
      worker = null;
      resolve(false);
    };
    w.onerror = fail;
    w.onmessage = (e: MessageEvent<{ type: string; id?: number; moves?: CandidateMove[] }>) => {
      if (e.data.type === 'ready') resolve(true);
      if (e.data.type === 'moves' && e.data.id !== undefined) {
        waiting.get(e.data.id)?.(e.data.moves ?? []);
        waiting.delete(e.data.id);
      }
    };
    w.postMessage({ type: 'init', words });
  });
}

/** All legal moves for a rack, best first. Uses the worker when it's available. */
export async function findMoves(grid: Grid, blanks: string[], rack: string[], budgetMs = 2500): Promise<CandidateMove[]> {
  const dict = await loadDictionary();
  if (worker && workerReady && (await workerReady) && worker) {
    const w = worker;
    const id = ++requestId;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        waiting.delete(id);
        resolve(generateMoves(grid, blanks, rack, dict, { deadline: Date.now() + budgetMs }));
      }, budgetMs + 4000);
      waiting.set(id, (moves) => {
        clearTimeout(timer);
        resolve(moves);
      });
      w.postMessage({ type: 'moves', id, grid, blanks, rack, budgetMs });
    });
  }
  await new Promise((r) => setTimeout(r, 0));
  return generateMoves(grid, blanks, rack, dict, { deadline: Date.now() + budgetMs });
}

/** Server-side check, used only when the word list couldn't be downloaded. */
export async function checkWordsOnServer(words: string[]): Promise<Record<string, boolean>> {
  const res = await fetch('/api/check-word', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ words }),
  });
  if (!res.ok) throw new Error('Word check failed');
  return ((await res.json()) as { results: Record<string, boolean> }).results;
}
