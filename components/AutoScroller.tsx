"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { PlaybackClock } from "@/hooks/usePlaybackClock";
import { weightedProgressToScrollTop } from "@/lib/playback/sheet-map";
import type { LiveSheetMap } from "@/lib/playback/sheet-lines";

type Props = {
  enabled: boolean;
  clock: PlaybackClock;
  durationMs: number;
  targetRef: React.RefObject<HTMLElement | null>;
  /** From useSheetMap. Rebuilds are owned there, not here. */
  map: LiveSheetMap | null;
};

// Pause auto-scroll for this long after the user interacts (wheel/touch).
// Resumes automatically afterwards.
const USER_INTERACTION_PAUSE_MS = 4000;

/**
 * Applies the playback clock to scrollTop.
 *
 * The clock itself lives in usePlaybackClock, because the chord strip needs it
 * while auto-scroll is switched off, and the sheet map is rebuilt by
 * useSheetMap, because the strip and the line highlight need the same map. What
 * is left here is scroll behaviour: the RAF loop, the user's manual offset, and
 * the interaction pause.
 */
export function AutoScroller({ enabled, clock, durationMs, targetRef, map }: Props) {
  const rafRef = useRef<number | null>(null);
  const pauseUntilRef = useRef<number>(0);
  const userOffsetRef = useRef<number>(0);
  const lastComputedRef = useRef<number>(0);
  // Read through a ref so a rebuild does not tear down the RAF loop, which
  // would discard the user's manual offset and their interaction pause. Written
  // in a layout effect rather than during render: the RAF loop reads it on the
  // next frame either way, and render-phase ref writes are a React hazard.
  const mapRef = useRef<LiveSheetMap | null>(map);
  useLayoutEffect(() => { mapRef.current = map; }, [map]);

  useEffect(() => {
    if (!enabled || !targetRef.current || durationMs <= 0) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    userOffsetRef.current = 0;
    pauseUntilRef.current = 0;
    const el = targetRef.current;

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
      const now = performance.now();
      if (now >= pauseUntilRef.current) {
        const pct = Math.max(0, Math.min(1, clock.getScrollProgressMs() / durationMs));
        const max = Math.max(0, el.scrollHeight - el.clientHeight);
        const computed = mapRef.current
          ? weightedProgressToScrollTop(pct, mapRef.current, max)
          : pct * max;
        lastComputedRef.current = computed;
        el.scrollTop = Math.max(0, Math.min(max, computed + userOffsetRef.current));
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
    };
  // map deliberately excluded: it is read through mapRef so a rebuild does not
  // tear down the loop and discard the user's manual offset and interaction
  // pause. See the mapRef comment above.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, durationMs, targetRef, clock]);

  return null;
}
