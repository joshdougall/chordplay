"use client";

import { useEffect, useRef } from "react";
import {
  compensateProgress,
  virtualProgressAt,
  nextClockState,
  reanchorForSpeedChange,
  type ClockState,
} from "@/lib/playback/clock";

export type PlaybackClock = {
  /** True playback position. The chord strip and the line highlight read this. */
  getProgressMs(): number;
  /** Speed-adjusted position. AutoScroller reads this. */
  getScrollProgressMs(): number;
};

/**
 * Owns the two playback anchors.
 *
 * `anchor` tracks real playback and is what the strip reads. `scrollAnchor`
 * advances at speedMultiplier and is what the scroll reads. They are separate
 * because the speed control exists so the user can say "the sheet is drifting,
 * move it faster", which is a statement about the scroll and must not move the
 * chord the strip claims is sounding.
 *
 * Keeping both here means AutoScroller holds no anchor at all and simply reads
 * a number, rather than owning a second anchor whose seek and speed-change
 * behaviour would have to be kept in step with this one by hand.
 */
export function usePlaybackClock({
  trackId,
  progressMs,
  sampleAgeMs,
  isPlaying,
  durationMs,
  speedMultiplier,
}: {
  trackId: string | null;
  progressMs: number;
  sampleAgeMs: number;
  isPlaying: boolean;
  durationMs: number;
  speedMultiplier: number;
}): PlaybackClock {
  const stateRef = useRef<ClockState>({
    anchor: { progressMs: 0, at: 0 },
    scrollAnchor: { progressMs: 0, at: 0 },
  });
  const prevTrackRef = useRef<string | null>(null);
  const speedRef = useRef<number>(speedMultiplier);
  const playingRef = useRef<boolean>(isPlaying);

  // Absorb each polled sample. Deliberately keyed off the sample inputs only:
  // this must not re-run on every render, or the anchors reset 30 times a
  // minute as the 2s poll re-renders the page.
  useEffect(() => {
    const now = performance.now();
    // compensateProgress adds nothing while paused, so a paused sample is exact.
    const real = compensateProgress(progressMs, now - sampleAgeMs, now, isPlaying);
    const next = nextClockState(stateRef.current, {
      trackId,
      prevTrackId: prevTrackRef.current,
      realProgressMs: real,
      now,
      durationMs,
      isPlaying,
      wasPlaying: playingRef.current,
    });
    stateRef.current = { anchor: next.anchor, scrollAnchor: next.scrollAnchor };
    prevTrackRef.current = trackId;
    playingRef.current = isPlaying;
  }, [trackId, progressMs, sampleAgeMs, isPlaying, durationMs]);

  // A speed change must not move the sheet. Re-anchor to the current virtual
  // position at the OLD speed, then let the new one take over from there.
  useEffect(() => {
    const prev = speedRef.current;
    if (prev === speedMultiplier) return;
    speedRef.current = speedMultiplier;
    stateRef.current = {
      ...stateRef.current,
      scrollAnchor: reanchorForSpeedChange(
        stateRef.current.scrollAnchor,
        prev,
        performance.now()
      ),
    };
  }, [speedMultiplier]);

  const clockRef = useRef<PlaybackClock>({
    getProgressMs: () =>
      playingRef.current
        ? virtualProgressAt(stateRef.current.anchor, performance.now(), 1)
        : stateRef.current.anchor.progressMs,
    getScrollProgressMs: () =>
      playingRef.current
        ? virtualProgressAt(stateRef.current.scrollAnchor, performance.now(), speedRef.current)
        : stateRef.current.scrollAnchor.progressMs,
  });

  return clockRef.current;
}
