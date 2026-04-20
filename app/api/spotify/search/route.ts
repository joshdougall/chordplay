import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { getAccessToken } from "@/lib/auth/spotify";
import { getSession } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const cfg = getConfig();
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ tracks: [] });

  let token: string;
  try {
    token = await getAccessToken(cfg, session.userId);
  } catch {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", q);
  url.searchParams.set("type", "track");
  url.searchParams.set("limit", "20");

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  if (!res.ok) return NextResponse.json({ error: `spotify ${res.status}` }, { status: 502 });
  const data = await res.json();
  const tracks = (data.tracks?.items ?? []).map((t: { id: string; name: string; artists: { name: string }[]; album?: { images?: { url: string }[] }; duration_ms?: number }) => ({
    trackId: t.id,
    title: t.name,
    artists: t.artists.map((a: { name: string }) => a.name),
    albumArt: t.album?.images?.[0]?.url ?? null,
    durationMs: t.duration_ms ?? 0
  }));
  return NextResponse.json({ tracks });
}
