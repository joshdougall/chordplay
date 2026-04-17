import { NextResponse } from "next/server";
import { libraryReady, getLibrary } from "@/lib/library/singleton";

export async function GET() {
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
