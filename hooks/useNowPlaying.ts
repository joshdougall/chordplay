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
    // Self-rescheduling timeout, not setInterval. `backoff` was doubled on every
    // failure and then never read, because the interval was fixed at intervalMs:
    // on a dropped connection that meant 30 requests a minute, indefinitely, each
    // one attempting a Spotify token refresh behind it. This is an RV on LTE.
    let handle: number | undefined;
    const loop = async () => {
      await tick();
      if (cancelled) return;
      handle = window.setTimeout(loop, visibleRef.current ? backoff : intervalMs);
    };
    void loop();

    return () => {
      cancelled = true;
      if (handle !== undefined) window.clearTimeout(handle);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [intervalMs]);

  return state;
}
