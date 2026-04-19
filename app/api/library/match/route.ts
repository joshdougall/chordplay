import { NextRequest, NextResponse } from "next/server";
import { libraryReady, getLibrary } from "@/lib/library/singleton";
import { match } from "@/lib/library/matcher";
import { readPrefs } from "@/lib/prefs/store";
import { getConfig } from "@/lib/config";
import { getSession } from "@/lib/auth/session";
import { recordEvent } from "@/lib/usage/db";

export async function GET(req: NextRequest) {
  await libraryReady();
  const url = new URL(req.url);
  const trackId = url.searchParams.get("track_id");
  const title = url.searchParams.get("title") ?? "";
  const artist = url.searchParams.get("artist") ?? "";
  if (!trackId) return NextResponse.json({ error: "track_id required" }, { status: 400 });

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const cfg = getConfig();
  const prefs = await readPrefs(cfg.dataPath, session.userId);
  const result = match(getLibrary(), { trackId, title, artists: [artist] }, {
    trackOverrides: prefs.trackOverrides
  });
  try {
    recordEvent(session.userId, "match", {
      trackId,
      outcome: result.match ? (result.confidence === "exact" ? "hit" : "fuzzy") : "miss",
      matchId: result.match?.id ?? null,
      confidence: result.confidence,
      score: result.score ?? null,
    });
  } catch { /* non-fatal */ }
  return NextResponse.json(result);
}
