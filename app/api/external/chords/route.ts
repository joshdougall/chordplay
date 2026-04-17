import { NextRequest, NextResponse } from "next/server";
import { fetchChordieChords } from "@/lib/external/chordie";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const title = url.searchParams.get("title")?.trim();
  const artist = url.searchParams.get("artist")?.trim();
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const result = await fetchChordieChords(artist ?? "", title);
  if (!result) return NextResponse.json({ match: null });
  return NextResponse.json({ match: result });
}
