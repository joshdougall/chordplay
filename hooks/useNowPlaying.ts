"use client";

import { useEffect, useRef, useState } from "react";
import type { NowPlaying } from "@/lib/spotify/now-playing-cache";

type State = {
  data: NowPlaying;
  loading: boolean;
  error: string | null;
};

export function useNowPlaying(intervalMs = 2000) {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });
  const visibleRef = useRef(true);

  useEffect(() => {
    const onVis = () => { visibleRef.current = document.visibilityState === "visible"; };
    document.addEventListener("visibilitychange", onVis);
    let cancelled = false;
    let backoff = intervalMs;

    const tick = async () => {
      if (!visibleRef.current) return;
      try {
        const res = await fetch("/api/now-playing");
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as NowPlaying;
        if (cancelled) return;
        setState({ data: json, loading: false, error: null });
        backoff = intervalMs;
      } catch (err) {
        if (cancelled) return;
        setState(s => ({ ...s, error: (err as Error).message, loading: false }));
        backoff = Math.min(backoff * 2, 30_000);
      }
    };
    tick();
    const handle = window.setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [intervalMs]);

  return state;
}
