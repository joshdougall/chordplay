export type NowPlaying = {
  trackId: string;
  title: string;
  artists: string[];
  albumArt: string | null;
  progressMs: number;
  durationMs: number;
  isPlaying: boolean;
} | null;

type Entry = { value: NowPlaying; at: number };

export function makeNowPlayingCache(fetcher: () => Promise<NowPlaying>, ttlMs: number) {
  let entry: Entry | null = null;
  let inflight: Promise<NowPlaying> | null = null;

  return {
    async get(): Promise<NowPlaying> {
      if (entry && Date.now() - entry.at < ttlMs) return entry.value;
      if (inflight) return inflight;
      inflight = (async () => {
        try {
          const v = await fetcher();
          entry = { value: v, at: Date.now() };
          return v;
        } finally {
          inflight = null;
        }
      })();
      return inflight;
    },
    invalidate() { entry = null; }
  };
}
