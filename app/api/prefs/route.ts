import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { readPrefs, writePrefs, Prefs } from "@/lib/prefs/store";
import { getSession } from "@/lib/auth/session";
import { recordEvent } from "@/lib/usage/db";
import { mergePrefs } from "@/lib/prefs/merge";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  const cfg = getConfig();
  const p = await readPrefs(cfg.dataPath, session.userId);
  return NextResponse.json(p);
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  const cfg = getConfig();
  const body = (await req.json()) as Partial<Prefs>;
  const current = await readPrefs(cfg.dataPath, session.userId);
  const merged: Prefs = mergePrefs(body, current);
  await writePrefs(cfg.dataPath, session.userId, merged);

  // Emit transpose events for each songId whose value changed
  if (body.songTranspose) {
    const prev = current.songTranspose ?? {};
    for (const [songId, semitones] of Object.entries(body.songTranspose)) {
      if ((prev[songId] ?? 0) !== semitones) {
        try { recordEvent(session.userId, "transpose", { songId, semitones }); } catch { /* non-fatal */ }
      }
    }
  }

  return NextResponse.json(merged);
}
