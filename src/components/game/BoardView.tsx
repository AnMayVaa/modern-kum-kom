'use client';

import { memo } from 'react';
import { BOARD_SIZE, GRID_ROWS, LETTER_SCORES, PREMIUM_LABELS } from '@/lib/game/constants';
import { cellKey, Grid, isMainRow, premiumAt } from '@/lib/game/board';
import { isLowerContent } from '@/lib/game/thai';

const ROWS = Array.from({ length: GRID_ROWS }, (_, r) => (isMainRow(r) ? 'var(--cell)' : 'var(--mark)')).join(' ');
const SHORT: Record<string, string> = { '2L': '2L', '3L': '3L', '4L': '4L', '2W': '2W', '3W': '3W', STAR: '★' };

interface Props {
  grid: Grid;
  blanks: Set<string>;
  draftKeys: Set<string>;
  lastKeys: Set<string>;
  /** Mark cells that can take a vowel or tone right now. */
  canMark: (r: number, c: number) => boolean;
  interactive: boolean;
  onCell: (r: number, c: number) => void;
}

function BoardViewImpl({ grid, blanks, draftKeys, lastKeys, canMark, interactive, onCell }: Props) {
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const key = cellKey(r, c);
      const ch = grid[r][c];
      if (isMainRow(r)) {
        const premium = premiumAt(r, c);
        const blank = blanks.has(key);
        cells.push(
          <button
            key={key}
            type="button"
            className="sq"
            data-premium={premium ?? undefined}
            data-draft={draftKeys.has(key) || undefined}
            data-last={(!draftKeys.has(key) && lastKeys.has(key)) || undefined}
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
              premium && <span aria-hidden>{SHORT[premium]}</span>
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
