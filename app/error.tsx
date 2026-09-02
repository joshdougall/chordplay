"use client";

import { useEffect } from "react";
import Link from "next/link";
import { clientLog } from "@/lib/client-logger";

/**
 * Route-level error boundary.
 *
 * There was none, so a render throw anywhere unmounted the entire tree to
 * Next's default error page. That matters here because sheet content comes
 * from third-party scrapers and is shape-unstable by design: ChordProView
 * guards its own parsing, but ChordDiagram (svguitar), TabView (alphaTab) and
 * the split-view path do not.
 *
 * Recovery is offered rather than assumed, and the sheet you were on is named
 * so you know what failed.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    clientLog("error", "route error boundary caught a render failure", {
      name: error.name,
      message: error.message,
      digest: error.digest,
      location: typeof window !== "undefined" ? window.location.pathname : undefined,
    });
  }, [error]);

  return (
    <div className="p-6 flex flex-col gap-4 max-w-xl mx-auto">
      <h1 className="text-lg font-semibold" style={{ color: "var(--ink)" }}>
        This sheet didn&apos;t render
      </h1>
      <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
        Something in the page failed while drawing. Your library is untouched.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={reset}
          className="h-10 px-4 rounded text-sm"
          style={{ backgroundColor: "var(--accent)", color: "var(--bg)" }}
        >
          Try again
        </button>
        <Link
          href="/library"
          className="h-10 px-4 rounded text-sm flex items-center"
          style={{ backgroundColor: "var(--bg-alt)", color: "var(--ink)", border: "1px solid var(--border)" }}
        >
          Back to library
        </Link>
      </div>
      {error.message && (
        <pre
          className="text-xs overflow-x-auto p-3 rounded"
          style={{ backgroundColor: "var(--bg-surface)", color: "var(--ink-faint)", border: "1px solid var(--border)" }}
        >{error.message}</pre>
      )}
    </div>
  );
}
