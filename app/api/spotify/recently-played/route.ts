import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { getAccessToken } from "@/lib/auth/spotify";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ tracks: [] }, { status: 401 });
  const cfg = getConfig();
  let token: string;
  try { token = await getAccessToken(cfg, session.userId); }
  catch { return NextResponse.json({ tracks: [] }, { status: 401 }); }
  const res = await fetch("https://api.spotify.com/v1/me/player/recently-played?limit=1", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return NextResponse.json({ tracks: [] });
  const data = await res.json();
  const t = data.items?.[0]?.track;
  if (!t) return NextResponse.json({ tracks: [] });
  return NextResponse.json({
    tracks: [{
      trackId: t.id, title: t.name,
      artists: t.artists.map((a: { name: string }) => a.name),
      albumArt: t.album?.images?.[0]?.url ?? null,
      durationMs: t.duration_ms ?? 0,
      playedAt: data.items[0].played_at
    }]
  });
}
