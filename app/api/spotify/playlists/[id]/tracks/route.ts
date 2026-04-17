import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { getAccessToken } from "@/lib/auth/spotify";
import { getSession } from "@/lib/auth/session";

type SpotifyTrackItem = {
  track: {
    id: string;
    name: string;
    artists: { name: string }[];
    album: { images: { url: string }[] };
    duration_ms: number;
  } | null;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  const { id } = await params;
  const cfg = getConfig();
  let token: string;
  try { token = await getAccessToken(cfg, session.userId); }
  catch { return NextResponse.json({ error: "not authenticated" }, { status: 401 }); }

  const tracks: { trackId: string; title: string; artists: string[]; albumArt: string | null; durationMs: number }[] = [];
  let url: string | null = `https://api.spotify.com/v1/playlists/${encodeURIComponent(id)}/tracks?limit=100&fields=next,items(track(id,name,artists,album.images,duration_ms))`;

  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) break;
    const data = await res.json();
    for (const item of (data.items ?? []) as SpotifyTrackItem[]) {
      const t = item.track;
      if (!t || !t.id) continue;
      tracks.push({
        trackId: t.id,
        title: t.name,
        artists: t.artists.map(a => a.name),
        albumArt: t.album?.images?.[0]?.url ?? null,
        durationMs: t.duration_ms ?? 0,
      });
    }
    url = data.next ?? null;
  }

  return NextResponse.json({ tracks });
}
