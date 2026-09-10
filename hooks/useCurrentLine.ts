"use client";

import { useEffect, useRef } from "react";
import type { PlaybackClock } from "@/hooks/usePlaybackClock";
import { unitIndexAtFraction } from "@/lib/playback/sheet-map";
import type { LiveSheetMap } from "@/lib/playback/sheet-lines";

const CLASS = "chord-line-current";

/**
 * Marks the sheet line the playback clock is currently on.
 *
 * Line-level rather than chord-level on purpose: line position is the part of
 * the estimate the auto-scroll already relies on, whereas chord position within
 * a line is the least reliable part, and a confidently wrong chord highlight is
 * worse than none.
 *
 * unitLineIndex already resolves a paired positional unit to its lyric line, so
 * the highlight sits under the words rather than on the chord row above them.
 */
export function useCurrentLine({
  enabled,
  clock,
  durationMs,
  isPlaying,
  map,
}: {
  enabled: boolean;
  clock: PlaybackClock | null;
  durationMs: number;
  isPlaying: boolean;
  map: LiveSheetMap | null;
}): void {
  const markedRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const clear = () => {
      if (markedRef.current) {
        markedRef.current.classList.remove(CLASS);
        markedRef.current = null;
      }
    };

    const step = () => {
      if (map && clock && durationMs > 0) {
        const idx = unitIndexAtFraction(clock.getProgressMs() / durationMs, map);
        const el = map.unitElements[idx] ?? null;
        // Swap only on a change, not every frame.
        if (el !== markedRef.current) {
          clear();
          if (el) { el.classList.add(CLASS); markedRef.current = el; }
        }
      }
      if (isPlaying) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clear();
    };
  }, [enabled, clock, durationMs, isPlaying, map]);
}
