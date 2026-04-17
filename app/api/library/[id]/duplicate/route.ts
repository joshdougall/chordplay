import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { getConfig } from "@/lib/config";
import { writeEntry, safePath } from "@/lib/library/editor";
import { getLibrary, libraryReady } from "@/lib/library/singleton";
import { getSession } from "@/lib/auth/session";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  await libraryReady();
  const { id } = await params;
  const decoded = decodeURIComponent(id);
  const cfg = getConfig();
  const entry = getLibrary().get(decoded);
  if (!entry) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = (await req.json()) as { versionName?: string };
  if (!body.versionName || typeof body.versionName !== "string") {
    return NextResponse.json({ error: "versionName required" }, { status: 400 });
  }
  const versionName = body.versionName.trim();

  try {
    const sourcePath = safePath(cfg.libraryPath, decoded);
    let content = await readFile(sourcePath, "utf8");

    // Insert or replace {version: ...} directive after the first directive block
    const versionDirective = `{version: ${versionName}}`;
    const versionRegex = /\{\s*version\s*:[^}]+\}/i;
    if (versionRegex.test(content)) {
      content = content.replace(versionRegex, versionDirective);
    } else {
      // Insert after last known directive line
      const artistMatch = content.match(/\{\s*artist\s*:[^}]+\}\s*\n?/i);
      if (artistMatch) {
        const idx = (artistMatch.index ?? 0) + artistMatch[0].length;
        content = content.slice(0, idx) + versionDirective + "\n" + content.slice(idx);
      } else {
        content = versionDirective + "\n" + content;
      }
    }

    // Generate a new filename based on source with version suffix
    const sourceBase = basename(decoded);
    const ext = sourceBase.includes(".") ? sourceBase.slice(sourceBase.lastIndexOf(".")) : ".pro";
    const noExt = sourceBase.includes(".") ? sourceBase.slice(0, sourceBase.lastIndexOf(".")) : sourceBase;
    const safeName = versionName.replace(/[^\p{L}\p{N}\s.-]/gu, "").trim().replace(/\s+/g, "_");
    const newFilename = `${noExt}-${safeName}${ext}`;
    const folder = dirname(decoded);
    const newId = folder === "." ? newFilename : join(folder, newFilename);

    await writeEntry(cfg.libraryPath, newId, content);
    await getLibrary().addOrUpdate(safePath(cfg.libraryPath, newId));

    return NextResponse.json({ ok: true, id: newId });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
