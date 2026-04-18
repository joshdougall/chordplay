"use client";

export function clientLog(level: "info" | "warn" | "error", msg: string, fields: Record<string, unknown> = {}) {
  try {
    fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level, msg, ...fields }),
      keepalive: true
    }).catch(() => {});
  } catch {
    // swallow — logging must never break the page
  }
}
