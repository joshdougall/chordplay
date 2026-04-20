import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { getSession } from "@/lib/auth/session";
import { readUserChordDb, writeUserChordDb } from "@/lib/chord-diagrams/user-chord-db";
import type { ChordEntry } from "@/lib/chord-diagrams/chord-db";
import { logger } from "@/lib/logger";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  const cfg = getConfig();
  const db = await readUserChordDb(cfg.dataPath, session.userId);
  return NextResponse.json({ overrides: db });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  const body = await req.json() as { name?: string; positions?: unknown };
  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  if (!body.positions || typeof body.positions !== "object") {
    return NextResponse.json({ error: "positions required" }, { status: 400 });
  }
  const positions = body.positions as ChordEntry;
  if (!Array.isArray(positions.fingers)) {
    return NextResponse.json({ error: "positions.fingers must be an array" }, { status: 400 });
  }
  const cfg = getConfig();
  const db = await readUserChordDb(cfg.dataPath, session.userId);
  db[body.name] = positions;
  await writeUserChordDb(cfg.dataPath, session.userId, db);
  logger.info({ userId: session.userId, chord: body.name }, "user chord diagram saved");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  const name = new URL(req.url).searchParams.get("name");
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const cfg = getConfig();
  const db = await readUserChordDb(cfg.dataPath, session.userId);
  delete db[name];
  await writeUserChordDb(cfg.dataPath, session.userId, db);
  logger.info({ userId: session.userId, chord: name }, "user chord diagram reset");
  return NextResponse.json({ ok: true });
}
