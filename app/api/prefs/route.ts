import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { readPrefs, writePrefs, Prefs } from "@/lib/prefs/store";
import { getSession } from "@/lib/auth/session";

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
  const merged: Prefs = {
    autoScroll: body.autoScroll ?? current.autoScroll,
    showChordDiagrams: body.showChordDiagrams ?? current.showChordDiagrams,
    songPreferences: body.songPreferences ?? current.songPreferences,
    trackOverrides: body.trackOverrides ?? current.trackOverrides,
    songTranspose: body.songTranspose ?? current.songTranspose,
  };
  await writePrefs(cfg.dataPath, session.userId, merged);
  return NextResponse.json(merged);
}
