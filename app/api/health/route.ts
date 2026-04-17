import { NextResponse } from "next/server";
import { access } from "node:fs/promises";
import { getConfig } from "@/lib/config";
import { libraryReady } from "@/lib/library/singleton";

export async function GET() {
  try {
    const cfg = getConfig();
    await access(cfg.libraryPath);
    await access(cfg.dataPath);
    await libraryReady();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 503 });
  }
}
