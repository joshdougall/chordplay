export type NowPlaying = {
  trackId: string;
  title: string;
  artists: string[];
  albumArt: string | null;
  progressMs: number;
  durationMs: number;
  isPlaying: boolean;
  /** Set by the API route: how stale progressMs was when sent. */
  sampleAgeMs?: number;
} | null;

type Entry = { value: NowPlaying; at: number };

export function makeNowPlayingCache(fetcher: () => Promise<NowPlaying>, ttlMs: number) {
  let entry: Entry | null = null;
  let inflight: Promise<NowPlaying> | null = null;

  return {
    async get(): Promise<NowPlaying> {
      return (await this.getEntry()).value;
    },
    /** Like get(), but also reports when the sample was actually taken, so
     *  callers can account for how stale a cached value is. */
    async getEntry(): Promise<Entry> {
      if (entry && Date.now() - entry.at < ttlMs) return entry;
      if (inflight) { const v = await inflight; return entry ?? { value: v, at: Date.now() }; }
      inflight = (async () => {
        try {
          const v = await fetcher();
          entry = { value: v, at: Date.now() };
          return v;
        } finally {
          inflight = null;
        }
      })();
      const v = await inflight;
      return entry ?? { value: v, at: Date.now() };
    },
    invalidate() { entry = null; }
  };
}
