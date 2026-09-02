import { NextRequest, NextResponse } from "next/server";
import { logger, sanitize } from "@/lib/logger";
import { getSession } from "@/lib/auth/session";
import { recordEvent } from "@/lib/usage/db";
import { buildClientLogLine, MAX_CLIENT_LOG_BYTES } from "@/lib/client-report";

/**
 * Client error reports.
 *
 * Deliberately unauthenticated: ClientErrorReporter is mounted in the root
 * layout so errors on the pre-login page still reach us. The defence is
 * therefore the shape and size of what we accept, not who may call it.
 *
 * Previously this read an unbounded body and spread every field into the log
 * line, which made it a write primitive against the SD card the whole Pi runs
 * from — including the chord library and every other service's data.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();

  // Read as text so we can cap it first. req.json() parses before we can look,
  // and an App Router handler has no default body-size limit.
  const raw = await req.text().catch(() => null);
  if (raw === null) return NextResponse.json({ ok: false }, { status: 400 });
  if (Buffer.byteLength(raw, "utf8") > MAX_CLIENT_LOG_BYTES) {
    return NextResponse.json({ ok: false, error: "too large" }, { status: 413 });
  }

  let body: unknown = null;
  try { body = JSON.parse(raw); } catch { body = null; }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const level = input.level;
  const shaped = buildClientLogLine(input);
  const msg = String(shaped.msg);
  const line = sanitize({ source: "client", userId: session?.userId, ...shaped });

  if (level === "error") {
    logger.error(line, msg);
    if (session) {
      try {
        recordEvent(session.userId, "error", {
          msg,
          source: "client",
          location: (shaped.location as string) ?? null,
        });
      } catch { /* non-fatal */ }
    }
  } else if (level === "warn") {
    logger.warn(line, msg);
  } else {
    logger.info(line, msg);
  }

  return NextResponse.json({ ok: true });
}
