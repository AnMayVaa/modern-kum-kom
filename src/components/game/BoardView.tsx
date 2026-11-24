'use client';

import { memo } from 'react';
import { BOARD_COLS, GRID_ROWS, LETTER_SCORES, PREMIUM_LABELS } from '@/lib/game/constants';
import { cellKey, Grid, isMainRow, premiumAt } from '@/lib/game/board';
import { isLowerContent } from '@/lib/game/thai';
import type { Cursor } from '@/hooks/useGame';

const ROWS = Array.from({ length: GRID_ROWS }, (_, r) => (isMainRow(r) ? 'var(--cell)' : 'var(--mark)')).join(' ');

// The printed board says "๓เท่า ของคำ" / "๕เท่า ของตัวอักษร"; these are the short forms.
const THAI_DIGIT = ['๐', '๑', '๒', '๓', '๔', '๕'];
function PremiumLabel({ premium }: { premium: string }) {
  if (premium === 'STAR') return <span aria-hidden>★</span>;
  return (
    <span className="sq-label" aria-hidden>
      <span className="sq-num">{THAI_DIGIT[Number(premium[0])]}เท่า</span>
      <span className="sq-of">{premium[1] === 'W' ? 'ของคำ' : 'ตัวอักษร'}</span>
    </span>
  );
}

interface Props {
  grid: Grid;
  blanks: Set<string>;
  draftKeys: Set<string>;
  lastKeys: Set<string>;
  cursor: Cursor | null;
  /** Mark cells that can take a vowel or tone right now. */
  canMark: (r: number, c: number) => boolean;
  interactive: boolean;
  onCell: (r: number, c: number) => void;
}

function BoardViewImpl({ grid, blanks, draftKeys, lastKeys, cursor, canMark, interactive, onCell }: Props) {
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const key = cellKey(r, c);
      const ch = grid[r][c];
      if (isMainRow(r)) {
        const premium = premiumAt(r, c);
        const blank = blanks.has(key);
        const atCursor = !!cursor && cursor.r === r && cursor.c === c;
        cells.push(
          <button
            key={key}
            type="button"
            className="sq"
            data-cell=""
            data-r={r}
            data-c={c}
            data-premium={premium ?? undefined}
            data-draft={draftKeys.has(key) || undefined}
            data-last={(!draftKeys.has(key) && lastKeys.has(key)) || undefined}
            data-cursor={atCursor ? cursor!.dir : undefined}
            disabled={!interactive}
            onClick={() => onCell(r, c)}
            aria-label={ch ? `${ch}${blank ? ' (เบี้ยว่าง)' : ''}` : premium ? PREMIUM_LABELS[premium] : 'ช่องว่าง'}
          >
            {ch ? (
              <span className="tile" data-blank={blank || undefined}>
                {ch}
                {!blank && <span className="tile-score">{LETTER_SCORES[ch] ?? 0}</span>}
              </span>
            ) : (
              premium && <PremiumLabel premium={premium} />
            )}
            {atCursor && !ch && (
              <span className="sq-cursor" aria-hidden>
                {cursor!.dir === 'h' ? '→' : '↓'}
              </span>
            )}
          </button>,
        );
      } else {
        const open = !ch && interactive && canMark(r, c);
        const lower = isLowerContent(ch);
        cells.push(
          <button
            key={key}
            type="button"
            className="mk"
            data-open={open || undefined}
            data-draft={draftKeys.has(key) || undefined}
            disabled={!interactive}
            tabIndex={open || ch ? 0 : -1}
            onClick={() => onCell(r, c)}
            aria-label={ch ? `เครื่องหมาย ${ch}` : 'ช่องสระและวรรณยุกต์'}
          >
            {ch && (
              <span className="mk-clip" data-pos={lower ? 'lower' : 'upper'} aria-hidden>
                <span className="mk-glyph">{`อ${ch}`}</span>
              </span>
            )}
          </button>,
        );
      }
    }
  }
  return (
    <div className="board-grid" style={{ gridTemplateRows: ROWS }}>
      {cells}
    </div>
  );
}

export const BoardView = memo(BoardViewImpl);
