import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { createEntry } from "@/lib/library/editor";
import { getLibrary, libraryReady } from "@/lib/library/singleton";
import type { Format } from "@/lib/library/format";
import { getSession } from "@/lib/auth/session";
import { recordEvent } from "@/lib/usage/db";

export async function POST(req: NextRequest) {
  await libraryReady();
  const body = (await req.json()) as {
    title: string;
    artist: string;
    format: Format;
    content: string;
    spotifyTrackId?: string;
    folder?: string;
  };
  if (!body.title || !body.format || body.content === undefined) {
    return NextResponse.json({ error: "title, format, content required" }, { status: 400 });
  }
  const session = await getSession();
  const cfg = getConfig();
  const id = await createEntry(cfg.libraryPath, body);
  await getLibrary().addOrUpdate(`${cfg.libraryPath}/${id}`);
  if (session) {
    try {
      recordEvent(session.userId, "save", { id, title: body.title, artist: body.artist, format: body.format });
    } catch { /* non-fatal */ }
  }
  return NextResponse.json({ id });
}
