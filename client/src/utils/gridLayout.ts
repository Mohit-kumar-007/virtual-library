/**
 * Picks how many columns the participant grid uses, so tiles GROW when few people are studying and
 * SHRINK (down to a readable minimum) as more join, instead of using fixed columns per screen size.
 * Your own tile is a 2x2 block of cells whenever there are two or more columns.
 */
export interface GridInput {
  /** other participants shown as tiles */
  others: number;
  /** your own tile is in the grid */
  hasOwn: boolean;
  /** grid width, px */
  width: number;
  /** vertical space left for the grid on the first screen, px */
  height: number;
  /** gap between tiles, px */
  gap: number;
}

/** Narrowest tile that is still readable (name, title and timer). */
export const TILE_MIN_W = 140;
/** Height of the name, title and description block under each video. */
export const TILE_META_H = 78;
const ASPECT = 9 / 16;

/** Widest a tile may grow. Smaller when your own (double-size) tile is in the grid so it never takes over the screen. */
export const maxTileWidth = (hasOwn: boolean): number => (hasOwn ? 320 : 440);

function rowsFor(others: number, hasOwn: boolean, cols: number): number {
  const ownCells = hasOwn ? (cols >= 2 ? 4 : 1) : 0;
  const rows = Math.max(1, Math.ceil((others + ownCells) / cols));
  return hasOwn && cols >= 2 ? Math.max(rows, 2) : rows;
}

/**
 * The fewest columns (so the biggest tiles) that still fit everyone on the first screen without
 * scrolling. If even the narrowest readable tiles do not fit, use as many columns as the width
 * allows and let the page scroll.
 */
export function pickColumns({ others, hasOwn, width, height, gap }: GridInput): number {
  const useful = Math.max(1, hasOwn ? others + 2 : others); // more columns than tiles would only leave gaps
  const maxCols = Math.min(useful, Math.max(1, Math.floor((width + gap) / (TILE_MIN_W + gap))));
  const minCols = Math.min(maxCols, Math.max(1, Math.ceil((width + gap) / (maxTileWidth(hasOwn) + gap))));
  for (let c = minCols; c <= maxCols; c++) {
    const w = (width - gap * (c - 1)) / c;
    const h = w * ASPECT + TILE_META_H;
    const rows = rowsFor(others, hasOwn, c);
    if (rows * h + (rows - 1) * gap <= height) return c;
  }
  return maxCols;
}
