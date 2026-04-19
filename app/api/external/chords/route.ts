import { NextRequest, NextResponse } from "next/server";
import { findChords } from "@/lib/external/chords";
import { withReqId } from "@/lib/logger";
import { getSession } from "@/lib/auth/session";
import { recordEvent } from "@/lib/usage/db";

export async function GET(req: NextRequest) {
  const reqId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const log = withReqId(reqId);
  const session = await getSession();

  const url = new URL(req.url);
  const title = url.searchParams.get("title")?.trim();
  const artist = url.searchParams.get("artist")?.trim();

  if (!title) {
    log.warn({ artist, title }, "external chords request missing title");
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  log.info({ artist, title }, "external chords request");
  const result = await findChords(artist ?? "", title);

  if (!result) {
    log.info({ artist, title, match: null }, "external chords response: no match");
    return NextResponse.json({ match: null });
  }

  log.info({ artist, title, source: result.source }, "external chords response: match found");
  if (session) {
    try {
      recordEvent(session.userId, "match", {
        title,
        artist: artist ?? null,
        outcome: "hit",
        source: result.source,
      });
    } catch { /* non-fatal */ }
  }
  return NextResponse.json({ match: result });
}
