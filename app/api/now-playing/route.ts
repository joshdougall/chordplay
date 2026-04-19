import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { getAccessToken } from "@/lib/auth/spotify";
import { getSession } from "@/lib/auth/session";
import { makeNowPlayingCache, type NowPlaying } from "@/lib/spotify/now-playing-cache";
import { recordEvent } from "@/lib/usage/db";

type NowPlayingCacheEntry = ReturnType<typeof makeNowPlayingCache>;
const caches = new Map<string, NowPlayingCacheEntry>();
// Track last seen trackId per user to avoid flooding on every 2s poll
const lastSeenTrack = new Map<string, string>();

function getCacheForUser(userId: string): NowPlayingCacheEntry {
  let c = caches.get(userId);
  if (!c) {
    c = makeNowPlayingCache(() => fetchFromSpotify(userId), 1000);
    caches.set(userId, c);
  }
  return c;
}

async function fetchFromSpotify(userId: string): Promise<NowPlaying> {
  const cfg = getConfig();
  let token: string;
  try { token = await getAccessToken(cfg, userId); }
  catch { return null; }

  const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.status === 204) return null;
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`spotify now-playing ${res.status}`);
  const data = await res.json();
  if (!data || !data.item) return null;
  return {
    trackId: data.item.id,
    title: data.item.name,
    artists: data.item.artists.map((a: { name: string }) => a.name),
    albumArt: data.item.album?.images?.[0]?.url ?? null,
    progressMs: data.progress_ms ?? 0,
    durationMs: data.item.duration_ms ?? 0,
    isPlaying: !!data.is_playing
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  try {
    const np = await getCacheForUser(session.userId).get();
    if (np?.trackId) {
      const last = lastSeenTrack.get(session.userId);
      if (last !== np.trackId) {
        lastSeenTrack.set(session.userId, np.trackId);
        try {
          recordEvent(session.userId, "play", {
            trackId: np.trackId,
            title: np.title,
            artist: np.artists.join(", "),
            albumArt: np.albumArt,
            durationMs: np.durationMs,
          });
        } catch { /* non-fatal */ }
      }
    }
    return NextResponse.json(np);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
