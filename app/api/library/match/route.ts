import { NextRequest, NextResponse } from "next/server";
import { libraryReady, getLibrary } from "@/lib/library/singleton";
import { match } from "@/lib/library/matcher";
import { readPrefs } from "@/lib/prefs/store";
import { getConfig } from "@/lib/config";

export async function GET(req: NextRequest) {
  await libraryReady();
  const url = new URL(req.url);
  const trackId = url.searchParams.get("track_id");
  const title = url.searchParams.get("title") ?? "";
  const artist = url.searchParams.get("artist") ?? "";
  if (!trackId) return NextResponse.json({ error: "track_id required" }, { status: 400 });

  const cfg = getConfig();
  const prefs = await readPrefs(cfg.dataPath);
  const result = match(getLibrary(), { trackId, title, artists: [artist] }, {
    trackOverrides: prefs.trackOverrides
  });
  return NextResponse.json(result);
}
