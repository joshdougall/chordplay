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

export function AutoScroller({ enabled, progressMs, durationMs, speedMultiplier = 1, targetRef }: Props) {
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<{ progressMs: number; at: number } | null>(null);
  const pauseUntilRef = useRef<number>(0);
  // When the user scrolls, remember the delta from our computed position so we
  // "drift" from where they left off rather than snapping back.
  const userOffsetRef = useRef<number>(0);
  const lastComputedRef = useRef<number>(0);

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

    const pause = () => {
      pauseUntilRef.current = performance.now() + USER_INTERACTION_PAUSE_MS;
      // Capture the user's current scrollTop relative to our last-computed baseline.
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
        const computed = pct * max;
        lastComputedRef.current = computed;
        // Apply the user's accumulated offset so we drift from where they were.
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
    };
  }, [enabled, progressMs, durationMs, speedMultiplier, targetRef]);

  return null;
}
