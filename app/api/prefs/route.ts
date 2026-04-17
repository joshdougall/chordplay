import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { readPrefs, writePrefs, Prefs } from "@/lib/prefs/store";

export async function GET() {
  const cfg = getConfig();
  const p = await readPrefs(cfg.dataPath);
  return NextResponse.json(p);
}

export async function PUT(req: NextRequest) {
  const cfg = getConfig();
  const body = (await req.json()) as Partial<Prefs>;
  const current = await readPrefs(cfg.dataPath);
  const merged: Prefs = {
    autoScroll: body.autoScroll ?? current.autoScroll,
    songPreferences: body.songPreferences ?? current.songPreferences,
    trackOverrides: body.trackOverrides ?? current.trackOverrides
  };
  await writePrefs(cfg.dataPath, merged);
  return NextResponse.json(merged);
}
