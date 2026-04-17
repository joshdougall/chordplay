import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { getAccessToken } from "@/lib/auth/spotify";
import { getSession } from "@/lib/auth/session";
import { makeNowPlayingCache, type NowPlaying } from "@/lib/spotify/now-playing-cache";

type NowPlayingCacheEntry = ReturnType<typeof makeNowPlayingCache>;
const caches = new Map<string, NowPlayingCacheEntry>();

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
    return NextResponse.json(np);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
