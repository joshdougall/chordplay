import { NextRequest, NextResponse } from "next/server";
import { logger, sanitize } from "@/lib/logger";
import { getSession } from "@/lib/auth/session";
import { recordEvent } from "@/lib/usage/db";

export async function POST(req: NextRequest) {
  const session = await getSession();
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false }, { status: 400 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { level, msg, ...rest } = body as any;
  const line = sanitize({ source: "client", userId: session?.userId, ...rest });
  if (level === "error") {
    logger.error(line, String(msg ?? "client error"));
    if (session) {
      try { recordEvent(session.userId, "error", { msg: String(msg ?? ""), source: "client", ...rest }); } catch { /* non-fatal */ }
    }
  } else if (level === "warn") logger.warn(line, String(msg ?? "client warn"));
  else logger.info(line, String(msg ?? "client"));
  return NextResponse.json({ ok: true });
}
