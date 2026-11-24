// Runs the move search off the main thread so the board stays responsive while the bot thinks.

import { generateMoves } from './bot';
import { Dictionary } from './dictionary';
import type { Grid } from './board';

type Request =
  | { type: 'init'; words: string[] }
  | { type: 'moves'; id: number; grid: Grid; blanks: string[]; rack: string[]; budgetMs: number };

const ctx = self as unknown as { postMessage(message: unknown): void; onmessage: ((e: MessageEvent<Request>) => void) | null };
let dict: Dictionary | null = null;

ctx.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'init') {
    dict = new Dictionary(msg.words);
    void dict.positionIndex; // build the search index now rather than on the bot's first turn
    ctx.postMessage({ type: 'ready' });
    return;
  }
  const moves = dict ? generateMoves(msg.grid, msg.blanks, msg.rack, dict, { deadline: Date.now() + msg.budgetMs }) : [];
  ctx.postMessage({ type: 'moves', id: msg.id, moves: moves.slice(0, 300) });
};
