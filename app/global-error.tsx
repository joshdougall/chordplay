"use client";

/**
 * Last-resort boundary, for a failure in the root layout itself. Must render
 * its own <html> and <body>, and cannot rely on the app's CSS having loaded,
 * so the few colours here are deliberately literal rather than tokens.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ backgroundColor: "#1a1614", color: "#f5f0e6", fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <div style={{ padding: "2rem", maxWidth: "36rem", margin: "0 auto" }}>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600 }}>Chordplay failed to start</h1>
          <p style={{ color: "#9a9084", fontSize: "0.875rem" }}>
            The app could not load. Your library is untouched.
          </p>
          <button
            onClick={reset}
            style={{
              minHeight: "2.5rem", padding: "0 1rem", borderRadius: "0.25rem",
              backgroundColor: "#e8b86b", color: "#1a1614", border: "none", fontSize: "0.875rem",
            }}
          >
            Reload
          </button>
          {error.digest && (
            <p style={{ color: "#9a9084", fontSize: "0.75rem", marginTop: "1rem" }}>
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
