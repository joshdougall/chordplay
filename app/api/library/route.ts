import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { createEntry, EntryExistsError } from "@/lib/library/editor";
import { getLibrary, libraryReady } from "@/lib/library/singleton";
import type { Format } from "@/lib/library/format";
import { getSession } from "@/lib/auth/session";
import { recordEvent } from "@/lib/usage/db";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  await libraryReady();
  const body = (await req.json()) as {
    title: string;
    artist: string;
    format: Format;
    content: string;
    spotifyTrackId?: string;
    folder?: string;
    overwrite?: boolean;
  };
  if (!body.title || !body.format || body.content === undefined) {
    return NextResponse.json({ error: "title, format, content required" }, { status: 400 });
  }
  const cfg = getConfig();
  let id: string;
  try {
    id = await createEntry(cfg.libraryPath, body);
  } catch (err) {
    // The filename is derived from artist+title, so a repeat save used to
    // replace an edited sheet with no warning and no undo.
    if (err instanceof EntryExistsError) {
      return NextResponse.json(
        { error: "exists", id: err.id, message: "You already have a sheet for this song." },
        { status: 409 }
      );
    }
    throw err;
  }
  await getLibrary().addOrUpdate(`${cfg.libraryPath}/${id}`);
  try {
    recordEvent(session.userId, "save", { id, title: body.title, artist: body.artist, format: body.format });
  } catch { /* non-fatal */ }
  return NextResponse.json({ id });
}
