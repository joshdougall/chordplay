"use client";

import { useEffect, useRef, useState } from "react";

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; url?: string; number?: number }
  | { status: "error"; message: string };

export function ReportIssueButton() {
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [includeContext, setIncludeContext] = useState(true);
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
  const titleRef = useRef<HTMLInputElement>(null);

  // Check availability once on mount by attempting a POST with a bad body —
  // 503 = not configured (hide), 400 = configured but bad input (show)
  useEffect(() => {
    fetch("/api/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    })
      .then(r => {
        setAvailable(r.status !== 503);
      })
      .catch(() => setAvailable(false));
  }, []);

  useEffect(() => {
    if (open && titleRef.current) titleRef.current.focus();
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  function closeModal() {
    setOpen(false);
    setTitle("");
    setDescription("");
    setIncludeContext(true);
    setSubmitState({ status: "idle" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitState.status === "submitting") return;
    setSubmitState({ status: "submitting" });
    try {
      const payload: Record<string, string> = { title, description };
      if (includeContext) {
        payload.page = window.location.href;
        payload.userAgent = navigator.userAgent;
      }
      const res = await fetch("/api/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { url?: string; number?: number; error?: string };
      if (!res.ok) {
        setSubmitState({ status: "error", message: data.error ?? `HTTP ${res.status}` });
      } else {
        setSubmitState({ status: "success", url: data.url, number: data.number });
      }
    } catch (err) {
      setSubmitState({ status: "error", message: (err as Error).message });
    }
  }

  if (available === false) return null;
  if (available === null) return null; // still checking

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{ color: "var(--ink-faint)" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--ink-muted)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--ink-faint)"; }}
        title="Report an issue"
      >
        Report issue
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-issue-title"
        >
          <div
            className="w-full max-w-md rounded-lg p-6 flex flex-col gap-4 shadow-xl"
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between">
              <h2
                id="report-issue-title"
                className="text-base font-semibold"
                style={{ color: "var(--ink)" }}
              >
                Report an issue
              </h2>
              <button
                onClick={closeModal}
                style={{ color: "var(--ink-faint)" }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {submitState.status === "success" ? (
              <div className="flex flex-col gap-3 text-sm">
                <p style={{ color: "var(--ink)" }}>Issue submitted — thank you!</p>
                {submitState.url && (
                  <a
                    href={submitState.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--accent)" }}
                  >
                    View issue #{submitState.number}
                  </a>
                )}
                <button
                  onClick={closeModal}
                  className="mt-2 px-4 py-2 rounded text-sm self-start"
                  style={{ backgroundColor: "var(--bg-alt)", color: "var(--ink-muted)", border: "1px solid var(--border)" }}
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="issue-title"
                    className="text-xs font-medium"
                    style={{ color: "var(--ink-muted)" }}
                  >
                    Title <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <input
                    id="issue-title"
                    ref={titleRef}
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Brief description of the problem"
                    required
                    minLength={3}
                    className="rounded px-3 py-2 text-sm w-full"
                    style={{
                      backgroundColor: "var(--bg-alt)",
                      border: "1px solid var(--border)",
                      color: "var(--ink)",
                      outline: "none",
                    }}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="issue-description"
                    className="text-xs font-medium"
                    style={{ color: "var(--ink-muted)" }}
                  >
                    Description
                  </label>
                  <textarea
                    id="issue-description"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Steps to reproduce, what you expected, what happened…"
                    rows={4}
                    className="rounded px-3 py-2 text-sm w-full resize-none"
                    style={{
                      backgroundColor: "var(--bg-alt)",
                      border: "1px solid var(--border)",
                      color: "var(--ink)",
                      outline: "none",
                    }}
                  />
                </div>

                <label className="flex items-center gap-2 text-sm" style={{ color: "var(--ink-muted)" }}>
                  <input
                    type="checkbox"
                    checked={includeContext}
                    onChange={e => setIncludeContext(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Include current page URL and browser info
                </label>

                {submitState.status === "error" && (
                  <p className="text-sm" style={{ color: "var(--danger)" }}>
                    Error: {submitState.message}
                  </p>
                )}

                <div className="flex items-center gap-3 justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 rounded text-sm"
                    style={{ backgroundColor: "var(--bg-alt)", color: "var(--ink-muted)", border: "1px solid var(--border)" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitState.status === "submitting" || title.length < 3}
                    className="px-4 py-2 rounded text-sm"
                    style={{
                      backgroundColor: "var(--accent)",
                      color: "var(--bg)",
                      opacity: submitState.status === "submitting" || title.length < 3 ? 0.6 : 1,
                    }}
                  >
                    {submitState.status === "submitting" ? "Submitting…" : "Submit"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
