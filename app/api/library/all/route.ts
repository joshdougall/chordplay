import { NextResponse } from "next/server";
import { libraryReady, getLibrary } from "@/lib/library/singleton";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  await libraryReady();
  const entries = getLibrary().all().map(e => ({
    id: e.id,
    title: e.title,
    artist: e.artist,
    format: e.format,
    spotifyTrackId: e.spotifyTrackId,
    parseError: e.parseError ?? false
  }));
  return NextResponse.json({ entries });
}
