import pino from "pino";

// Redact anything that looks like a secret anywhere in the log payload.
const redactPaths = [
  "*.token", "*.accessToken", "*.refreshToken",
  "*.secret", "*.apiKey", "*.authorization",
  "*.password",
  "token", "accessToken", "refreshToken", "secret", "apiKey", "authorization"
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { app: "chordplay" },
  redact: { paths: redactPaths, censor: "[REDACTED]" }
});

export function withReqId(reqId: string, userId?: string) {
  return logger.child({ reqId, userId });
}

/** Helper: recursively strip secret-y fields from a plain object before logging. Used when structured redact paths don't cover it. */
export function sanitize<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitize) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (/token|secret|key|authorization|password/i.test(k)) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = sanitize(v);
    }
  }
  return out as T;
}
