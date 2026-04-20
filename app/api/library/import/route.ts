import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { findChords } from "@/lib/external/chords";
import { createEntry } from "@/lib/library/editor";
import { getLibrary, libraryReady } from "@/lib/library/singleton";
import { getSession } from "@/lib/auth/session";
import { normalizeKey } from "@/lib/library/normalize";

type ImportBody = {
  trackId: string;
  title: string;
  artists: string[];
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  await libraryReady();
  const cfg = getConfig();
  const body = (await req.json()) as ImportBody;
  if (!body.trackId || !body.title || !Array.isArray(body.artists)) {
    return NextResponse.json({ error: "trackId, title, artists required" }, { status: 400 });
  }

  const library = getLibrary();

  // Check if already in library by trackId or normalized key
  const byId = library.lookupByTrackId(body.trackId);
  if (byId) return NextResponse.json({ created: false, libraryId: byId.id });

  const artist = body.artists.join(", ");
  const key = normalizeKey(artist, body.title);
  const byKey = library.lookupByKey(key);
  if (byKey.length > 0) return NextResponse.json({ created: false, libraryId: byKey[0].id });

  // Look up chords externally
  const chords = await findChords(artist, body.title);
  if (!chords) return NextResponse.json({ created: false });

  // Create the library entry
  try {
    const id = await createEntry(cfg.libraryPath, {
      title: body.title,
      artist,
      format: "chordpro",
      content: chords.content,
      spotifyTrackId: body.trackId,
    });
    await library.addOrUpdate(`${cfg.libraryPath}/${id}`);
    return NextResponse.json({ created: true, libraryId: id, source: chords.sourceName });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
