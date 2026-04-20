"use client";

import { useEffect, useRef } from "react";

type Props = {
  enabled: boolean;
  progressMs: number;
  durationMs: number;
  speedMultiplier?: number;
  targetRef: React.RefObject<HTMLElement | null>;
};

// Pause auto-scroll for this long after the user interacts (wheel/touch).
// Resumes automatically afterwards.
const USER_INTERACTION_PAUSE_MS = 4000;

// Weight given to a "sparse" row (chord-only, no lyrics — e.g. finger-picking
// intro, instrumental bridge). Lyric rows weight 1.0. Lower = scroll spends
// less time on instrumental sections.
const SPARSE_ROW_WEIGHT = 0.25;

/** Build a weighted progress → scrollTop map from the rendered chord sheet DOM.
 * Returns null if no `.chordpro .row` elements are found (caller falls back to linear). */
function buildRowMap(container: HTMLElement): { rowTops: number[]; cumWeight: number[]; totalWeight: number } | null {
  const rows = Array.from(container.querySelectorAll<HTMLElement>(".chordpro .row"));
  if (rows.length === 0) return null;

  const containerTop = container.getBoundingClientRect().top;
  const scrollOffset = container.scrollTop;

  const rowTops: number[] = [];
  const cumWeight: number[] = [];
  let total = 0;

  for (const row of rows) {
    const top = row.getBoundingClientRect().top - containerTop + scrollOffset;
    // A row has lyric content if any `.lyrics` descendant contains non-whitespace text.
    const lyricEls = row.querySelectorAll<HTMLElement>(".lyrics");
    let hasLyrics = false;
    for (const l of lyricEls) {
      if ((l.textContent ?? "").trim().length > 0) { hasLyrics = true; break; }
    }
    const weight = hasLyrics ? 1.0 : SPARSE_ROW_WEIGHT;
    total += weight;
    rowTops.push(top);
    cumWeight.push(total);
  }

  return { rowTops, cumWeight, totalWeight: total };
}

/** Given weighted cumulative weights and a target weight, return the scrollTop
 * for that position (interpolated between rows). */
function weightedProgressToScrollTop(
  pct: number,
  map: { rowTops: number[]; cumWeight: number[]; totalWeight: number },
  maxScroll: number
): number {
  if (map.totalWeight === 0 || map.rowTops.length === 0) return pct * maxScroll;
  const target = pct * map.totalWeight;
  // Binary search for the row whose cumulative weight crosses `target`.
  let lo = 0, hi = map.cumWeight.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (map.cumWeight[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  const rowIdx = lo;
  // Interpolate within the row for smoother scrolling
  const rowCumEnd = map.cumWeight[rowIdx];
  const rowCumStart = rowIdx > 0 ? map.cumWeight[rowIdx - 1] : 0;
  const rowWeight = rowCumEnd - rowCumStart;
  const intraRow = rowWeight > 0 ? (target - rowCumStart) / rowWeight : 0;
  const thisTop = map.rowTops[rowIdx];
  const nextTop = rowIdx + 1 < map.rowTops.length ? map.rowTops[rowIdx + 1] : Math.max(thisTop + 1, maxScroll);
  const interpolated = thisTop + (nextTop - thisTop) * intraRow;
  return Math.max(0, Math.min(maxScroll, interpolated));
}

export function AutoScroller({ enabled, progressMs, durationMs, speedMultiplier = 1, targetRef }: Props) {
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<{ progressMs: number; at: number } | null>(null);
  const pauseUntilRef = useRef<number>(0);
  const userOffsetRef = useRef<number>(0);
  const lastComputedRef = useRef<number>(0);
  const mapRef = useRef<ReturnType<typeof buildRowMap> | null>(null);

  useEffect(() => {
    if (!enabled || !targetRef.current || durationMs <= 0) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    startRef.current = { progressMs, at: performance.now() };
    userOffsetRef.current = 0;
    pauseUntilRef.current = 0;
    const el = targetRef.current;

    // Build the weighted row map after render. Retry briefly if ChordSheetJS hasn't
    // painted yet when we start.
    const rebuildMap = () => { mapRef.current = buildRowMap(el); };
    rebuildMap();
    const rebuildTimers = [50, 200, 600].map(ms => window.setTimeout(rebuildMap, ms));

    // Rebuild on window resize (content reflow changes row tops)
    const onResize = () => rebuildMap();
    window.addEventListener("resize", onResize);

    const pause = () => {
      pauseUntilRef.current = performance.now() + USER_INTERACTION_PAUSE_MS;
      userOffsetRef.current = el.scrollTop - lastComputedRef.current;
    };

    const onWheel = () => pause();
    const onTouchMove = () => pause();
    const onKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(e.key)) pause();
    };

    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("keydown", onKeyDown);

    const step = () => {
      if (!startRef.current || !el) return;
      const now = performance.now();
      if (now >= pauseUntilRef.current) {
        const elapsed = now - startRef.current.at;
        const virtualProgress = startRef.current.progressMs + elapsed * speedMultiplier;
        const pct = Math.max(0, Math.min(1, virtualProgress / durationMs));
        const max = Math.max(0, el.scrollHeight - el.clientHeight);
        const computed = mapRef.current
          ? weightedProgressToScrollTop(pct, mapRef.current, max)
          : pct * max;
        lastComputedRef.current = computed;
        const target = Math.max(0, Math.min(max, computed + userOffsetRef.current));
        el.scrollTop = target;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      rebuildTimers.forEach(t => window.clearTimeout(t));
    };
  }, [enabled, progressMs, durationMs, speedMultiplier, targetRef]);

  return null;
}
