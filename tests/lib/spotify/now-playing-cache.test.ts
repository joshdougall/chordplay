import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeNowPlayingCache, NowPlaying } from "@/lib/spotify/now-playing-cache";

describe("now-playing cache", () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it("returns cached value within TTL", async () => {
    const fetcher = vi.fn(async (): Promise<NowPlaying> => ({
      trackId: "a", title: "T", artists: ["A"], albumArt: null, progressMs: 0, durationMs: 1, isPlaying: true
    }));
    const cache = makeNowPlayingCache(fetcher, 1000);
    await cache.get();
    await cache.get();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("refreshes after TTL expires", async () => {
    const fetcher = vi.fn(async (): Promise<NowPlaying> => ({
      trackId: "a", title: "T", artists: ["A"], albumArt: null, progressMs: 0, durationMs: 1, isPlaying: true
    }));
    const cache = makeNowPlayingCache(fetcher, 1000);
    await cache.get();
    vi.advanceTimersByTime(1500);
    await cache.get();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("coalesces concurrent calls", async () => {
    let resolve!: (v: NowPlaying) => void;
    const fetcher = vi.fn(() => new Promise<NowPlaying>(r => { resolve = r; }));
    const cache = makeNowPlayingCache(fetcher as unknown as () => Promise<NowPlaying>, 1000);
    const p1 = cache.get();
    const p2 = cache.get();
    resolve({ trackId: "a", title: "t", artists: [], albumArt: null, progressMs: 0, durationMs: 1, isPlaying: true });
    await Promise.all([p1, p2]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
