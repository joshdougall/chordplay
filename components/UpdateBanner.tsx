"use client";

import { useEffect, useState } from "react";

const POLL_MS = 2 * 60 * 1000; // 2 minutes

export function UpdateBanner() {
  const bundled = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { version } = await res.json();
        if (cancelled) return;
        if (typeof version === "string") setServerVersion(version);
      } catch {
        // ignore transient network errors
      }
    };
    check();
    const handle = window.setInterval(check, POLL_MS);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  if (!serverVersion || serverVersion === bundled || dismissed) return null;

  return (
    <div
      className="w-full flex items-center justify-center gap-3 text-sm px-4 py-2"
      style={{
        backgroundColor: "var(--accent)",
        color: "var(--bg)",
      }}
      role="status"
      aria-live="polite"
    >
      <span>
        New version <span className="font-mono">{serverVersion}</span> available
        <span className="opacity-70"> (you are on {bundled})</span>
      </span>
      <button
        onClick={() => location.reload()}
        className="px-3 py-1 rounded text-xs font-semibold"
        style={{ backgroundColor: "var(--bg)", color: "var(--ink)" }}
      >
        Refresh to apply
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="px-2 text-xs opacity-70 hover:opacity-100"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
