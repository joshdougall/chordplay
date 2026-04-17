import { NextRequest, NextResponse } from "next/server";
import { findChords } from "@/lib/external/chords";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const title = url.searchParams.get("title")?.trim();
  const artist = url.searchParams.get("artist")?.trim();
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const result = await findChords(artist ?? "", title);
  if (!result) return NextResponse.json({ match: null });
  return NextResponse.json({ match: result });
}
