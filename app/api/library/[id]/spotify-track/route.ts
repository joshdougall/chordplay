import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { setSpotifyTrackId, safePath } from "@/lib/library/editor";
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
  const body = (await req.json()) as { trackId?: string };
  if (!body.trackId || typeof body.trackId !== "string") {
    return NextResponse.json({ error: "trackId required" }, { status: 400 });
  }
  try {
    await setSpotifyTrackId(cfg.libraryPath, decoded, body.trackId);
    await getLibrary().addOrUpdate(safePath(cfg.libraryPath, decoded));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
