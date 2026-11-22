import { describe, expect, it } from "vitest";
import { maxTileWidth, pickColumns, TILE_MIN_W } from "./gridLayout";

const laptop = { width: 1400, height: 750, gap: 16 };    // about a 1440x900 screen
const phone = { width: 366, height: 700, gap: 12 };      // about a 390x844 phone
const smallPhone = { width: 296, height: 460, gap: 12 }; // a 320x568 phone

describe("pickColumns", () => {
  it("keeps a lone tile in one column", () => {
    expect(pickColumns({ others: 1, hasOwn: false, ...laptop })).toBe(1);
  });
  it("uses two big columns for two people instead of six tiny ones", () => {
    expect(pickColumns({ others: 2, hasOwn: false, ...laptop })).toBe(2);
  });
  it("shrinks tiles so 30 people all fit on a laptop screen without scrolling", () => {
    expect(pickColumns({ others: 30, hasOwn: false, ...laptop })).toBe(8);
  });
  it("still fits everyone, with your own double-size tile, down to the smallest readable tile", () => {
    const cols = pickColumns({ others: 30, hasOwn: true, ...laptop });
    expect(cols).toBe(9);
    expect((laptop.width - laptop.gap * (cols - 1)) / cols).toBeGreaterThanOrEqual(TILE_MIN_W);
  });
  it("gives your own tile a 2x2 block next to a small group", () => {
    expect(pickColumns({ others: 2, hasOwn: true, ...laptop })).toBe(4);
  });
  it("stacks big tiles on a phone for two people, then goes to two columns", () => {
    expect(pickColumns({ others: 2, hasOwn: false, ...phone })).toBe(1);
    expect(pickColumns({ others: 3, hasOwn: false, ...phone })).toBe(2);
    expect(pickColumns({ others: 1, hasOwn: true, ...phone })).toBe(2);
  });
  it("keeps two readable columns on phones and scrolls when 30 people cannot fit", () => {
    expect(pickColumns({ others: 30, hasOwn: false, ...phone })).toBe(2);
    expect(pickColumns({ others: 30, hasOwn: false, ...smallPhone })).toBe(2);
  });
  it("falls back to one column when the grid is too narrow for two", () => {
    expect(pickColumns({ others: 5, hasOwn: false, width: 100, height: 600, gap: 12 })).toBe(1);
  });
  it("never uses more columns than there are tiles, and never fewer than one", () => {
    for (let others = 1; others <= 60; others++) {
      for (const hasOwn of [false, true]) for (const v of [laptop, phone, smallPhone]) {
        const cols = pickColumns({ others, hasOwn, ...v });
        expect(cols).toBeGreaterThanOrEqual(1);
        expect(cols).toBeLessThanOrEqual(Math.max(1, others + (hasOwn ? 2 : 0)));
      }
    }
  });
  it("adds columns (never removes them) as more people join", () => {
    let prev = 0;
    for (let others = 1; others <= 60; others++) {
      const cols = pickColumns({ others, hasOwn: false, ...laptop });
      expect(cols).toBeGreaterThanOrEqual(prev);
      prev = cols;
    }
  });
  it("caps tile width smaller when your own tile is in the grid", () => {
    expect(maxTileWidth(false)).toBe(440);
    expect(maxTileWidth(true)).toBe(320);
  });
});
