"use client";

import { useEffect, useRef } from "react";

type Props = {
  enabled: boolean;
  progressMs: number;
  durationMs: number;
  speedMultiplier?: number;
  targetRef: React.RefObject<HTMLElement | null>;
};

export function AutoScroller({ enabled, progressMs, durationMs, speedMultiplier = 1, targetRef }: Props) {
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<{ progressMs: number; at: number } | null>(null);

  useEffect(() => {
    if (!enabled || !targetRef.current || durationMs <= 0) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    startRef.current = { progressMs, at: performance.now() };
    const el = targetRef.current;

    const step = () => {
      if (!startRef.current || !el) return;
      const now = performance.now();
      const elapsed = now - startRef.current.at;
      const virtualProgress = startRef.current.progressMs + elapsed * speedMultiplier;
      const pct = Math.max(0, Math.min(1, virtualProgress / durationMs));
      const max = el.scrollHeight - el.clientHeight;
      el.scrollTop = pct * max;
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, progressMs, durationMs, speedMultiplier, targetRef]);

  return null;
}
