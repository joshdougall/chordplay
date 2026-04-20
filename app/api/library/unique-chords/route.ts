import { NextResponse } from "next/server";
import { libraryReady, getLibrary } from "@/lib/library/singleton";
import { readFile } from "node:fs/promises";
import { getSession } from "@/lib/auth/session";

const CHORD_RE = /\[([A-G][#b]?(?:m|M|maj|min|aug|dim|sus|add)?[0-9]*(?:\/[A-G][#b]?)?(?:[0-9]*)?)\]/g;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  await libraryReady();
  const lib = getLibrary();
  const chords = new Set<string>();

  for (const entry of lib.all()) {
    if (entry.format !== "chordpro") continue;
    try {
      const content = await readFile(entry.path, "utf8");
      let m: RegExpExecArray | null;
      CHORD_RE.lastIndex = 0;
      while ((m = CHORD_RE.exec(content)) !== null) {
        chords.add(m[1]);
      }
    } catch {
      // skip unreadable files
    }
  }

  return NextResponse.json({ chords: [...chords].sort() });
}
