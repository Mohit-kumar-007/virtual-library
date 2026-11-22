import { useLayoutEffect, useState, type RefObject } from "react";
import { pickColumns } from "../utils/gridLayout";

/** Room kept below the grid for the "silent room" line and the footer. */
const BOTTOM_PAD = 80;

/**
 * Measures the grid's real width and the screen height left for it, and returns how many columns to use.
 * Re-measures when the window, the grid (e.g. the leaderboard opening) or the page above it changes size.
 */
export function useGridColumns(ref: RefObject<HTMLElement | null>, others: number, hasOwn: boolean): number {
  const [cols, setCols] = useState(2);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const gap = parseFloat(getComputedStyle(el).columnGap) || 12;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const next = pickColumns({ others, hasOwn, width: el.clientWidth, height: window.innerHeight - top - BOTTOM_PAD, gap });
      setCols((c) => (c === next ? c : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el); ro.observe(document.documentElement);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [ref, others, hasOwn]);
  return cols;
}
