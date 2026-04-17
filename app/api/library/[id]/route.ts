import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { getConfig } from "@/lib/config";
import { writeEntry, safePath } from "@/lib/library/editor";
import { getLibrary, libraryReady } from "@/lib/library/singleton";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await libraryReady();
  const { id } = await params;
  const decoded = decodeURIComponent(id);
  const cfg = getConfig();
  const entry = getLibrary().get(decoded);
  if (!entry) return NextResponse.json({ error: "not found" }, { status: 404 });
  try {
    const full = safePath(cfg.libraryPath, decoded);
    const content = await readFile(full, "utf8");
    return NextResponse.json({ entry, content });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await libraryReady();
  const { id } = await params;
  const decoded = decodeURIComponent(id);
  const body = (await req.json()) as { content: string };
  if (typeof body.content !== "string") {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }
  const cfg = getConfig();
  try {
    await writeEntry(cfg.libraryPath, decoded, body.content);
    await getLibrary().addOrUpdate(safePath(cfg.libraryPath, decoded));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
