import { tileOptions, tileValue, isBlankTile } from '@/lib/game/tiles';

/** A rack tile: one letter, a dual tile such as ฆ/ซ, or a blank. */
export function RackTileFace({ tile }: { tile: string }) {
  const options = tileOptions(tile);
  return (
    <>
      {isBlankTile(tile) ? (
        <span className="text-[0.4em] font-medium text-kram-500">ว่าง</span>
      ) : options.length > 1 ? (
        <span className="flex items-baseline text-[0.78em] tracking-tight">
          {options[0]}
          <span className="mx-[0.04em] text-[0.6em] text-kram-500">/</span>
          {options[1]}
        </span>
      ) : (
        <span>{tile}</span>
      )}
      <span className="tile-score">{tileValue(tile)}</span>
    </>
  );
}

/** The game's name spelled in tiles: ค ำ ค ม. */
export function Wordmark({ size = 64 }: { size?: number }) {
  const letters: [string, number][] = [
    ['ค', 2],
    ['ำ', 2],
    ['ค', 2],
    ['ม', 1],
  ];
  return (
    <div className="flex gap-[0.08em]" style={{ fontSize: size }} aria-label="คำคม" role="img">
      {letters.map(([ch, score], i) => (
        <span
          key={i}
          className="tile h-[1em] w-[1em]"
          style={{ transform: `rotate(${[-4, 2, -2, 3][i]}deg) translateY(${[0, -0.04, 0.03, -0.02][i]}em)` }}
          aria-hidden
        >
          <span className="text-[0.66em]">{ch}</span>
          <span className="tile-score">{score}</span>
        </span>
      ))}
    </div>
  );
}
