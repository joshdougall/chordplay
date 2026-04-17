import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { createEntry } from "@/lib/library/editor";
import { getLibrary, libraryReady } from "@/lib/library/singleton";
import type { Format } from "@/lib/library/format";

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
  const cfg = getConfig();
  const id = await createEntry(cfg.libraryPath, body);
  await getLibrary().addOrUpdate(`${cfg.libraryPath}/${id}`);
  return NextResponse.json({ id });
}
