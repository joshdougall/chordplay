import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { getAccessToken } from "@/lib/auth/spotify";
import { getSession } from "@/lib/auth/session";

type SpotifyPlaylist = {
  id: string;
  name: string;
  description: string;
  images: { url: string }[];
  tracks: { total: number };
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  const cfg = getConfig();
  let token: string;
  try { token = await getAccessToken(cfg, session.userId); }
  catch { return NextResponse.json({ error: "not authenticated" }, { status: 401 }); }

  const playlists: { id: string; name: string; description: string; images: { url: string }[]; tracksTotal: number }[] = [];
  let url: string | null = "https://api.spotify.com/v1/me/playlists?limit=50";

  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) break;
    const data = await res.json();
    for (const p of (data.items ?? []) as SpotifyPlaylist[]) {
      playlists.push({
        id: p.id,
        name: p.name,
        description: p.description ?? "",
        images: p.images ?? [],
        tracksTotal: p.tracks?.total ?? 0,
      });
    }
    url = data.next ?? null;
  }

  return NextResponse.json({ playlists });
}
