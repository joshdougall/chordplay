/**
 * Shape a client-reported error into something safe to log.
 *
 * POST /api/log was unauthenticated, uncapped and unrate-limited, and spread
 * every field of the request body into the pino line. App Router handlers have
 * no default body-size limit, so a loop posting large bodies was a write
 * primitive against the Pi's SD card — and that card also holds the chord
 * library and every other service's data.
 *
 * It has to stay unauthenticated: ClientErrorReporter is mounted in the root
 * layout so it can report errors on the pre-login page. So the defence is the
 * shape of what we accept, not who may call it.
 */
export const MAX_CLIENT_LOG_BYTES = 8 * 1024;

const MAX_MSG = 500;
const MAX_STACK = 2000;
const MAX_FIELD = 300;

/** Only these are logged. Anything else in the body is discarded. */
const ALLOWED = ["location", "filename", "lineno", "colno", "name", "userAgent"] as const;

export function buildClientLogLine(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {
    msg: truncate(asString(body.msg ?? "client error"), MAX_MSG),
  };

  for (const key of ALLOWED) {
    const v = body[key];
    if (v === undefined || v === null) continue;
    if (typeof v === "number" && Number.isFinite(v)) { out[key] = v; continue; }
    if (typeof v === "string") { out[key] = truncate(v, MAX_FIELD); continue; }
    // Anything else (objects, arrays, functions) is dropped rather than
    // serialized: unbounded nesting is what made sanitize() burn CPU.
  }

  if (typeof body.stack === "string") out.stack = truncate(body.stack, MAX_STACK);
  return out;
}

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  try { return JSON.stringify(v) ?? String(v); } catch { return String(v); }
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…[truncated]`;
}
