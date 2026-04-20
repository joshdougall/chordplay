import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { getAccessToken } from "@/lib/auth/spotify";
import { getSession } from "@/lib/auth/session";

// GET /api/spotify/tracks?ids=id1,id2,id3
// Returns { tracks: [{ id, albumArt, title, artists[] }] }
// Spotify /v1/tracks?ids=... accepts up to 50 IDs per call

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const cfg = getConfig();
  const idsParam = new URL(req.url).searchParams.get("ids")?.trim();
  if (!idsParam) return NextResponse.json({ tracks: [] });

  const ids = idsParam.split(",").map(s => s.trim()).filter(Boolean).slice(0, 50);
  if (ids.length === 0) return NextResponse.json({ tracks: [] });

  let token: string;
  try {
    token = await getAccessToken(cfg, session.userId);
  } catch {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const url = new URL("https://api.spotify.com/v1/tracks");
  url.searchParams.set("ids", ids.join(","));

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  if (!res.ok) return NextResponse.json({ error: `spotify ${res.status}` }, { status: 502 });

  const data = await res.json();
  const tracks = ((data.tracks ?? []) as Array<{
    id: string;
    name: string;
    artists: { name: string }[];
    album?: { images?: { url: string }[] };
  } | null>)
    .filter((t): t is NonNullable<typeof t> => t !== null)
    .map(t => ({
      id: t.id,
      title: t.name,
      artists: t.artists.map((a: { name: string }) => a.name),
      albumArt: t.album?.images?.[0]?.url ?? null
    }));

  return NextResponse.json({ tracks });
}
