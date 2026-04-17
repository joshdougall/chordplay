"use client";

import { useEffect, useState } from "react";
import type { Prefs } from "@/lib/prefs/store";

export default function SettingsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [healthInfo, setHealthInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then(r => r.json())
      .then(body => { if (body.userId) setUserId(body.userId); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/prefs")
      .then(r => r.json())
      .then(setPrefs)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/health")
      .then(r => r.json())
      .then(() => setHealthInfo("OK"))
      .catch(() => setHealthInfo("Unavailable"));
  }, []);

  async function toggleAutoScroll() {
    if (!prefs) return;
    const next = { ...prefs, autoScroll: !prefs.autoScroll };
    setPrefs(next);
    setSaving(true);
    try {
      await fetch("/api/prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next)
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleChordDiagrams() {
    if (!prefs) return;
    const next = { ...prefs, showChordDiagrams: !prefs.showChordDiagrams };
    setPrefs(next);
    setSaving(true);
    try {
      await fetch("/api/prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next)
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-lg flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>Account</h2>
        <div className="rounded p-4 flex flex-col gap-3 text-sm" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--ink-muted)" }}>Signed in as</span>
            <span className="font-mono" style={{ color: "var(--ink)" }}>{userId ?? "…"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--ink-muted)" }}>Library status</span>
            <span style={{ color: "var(--ink)" }}>{healthInfo ?? "…"}</span>
          </div>
          <form action="/api/auth/logout" method="post" className="pt-1">
            <button
              type="submit"
              className="px-4 py-2 rounded text-sm transition-colors"
              style={{ backgroundColor: "var(--bg-alt)", color: "var(--ink-muted)", border: "1px solid var(--border)" }}
            >
              Log out
            </button>
          </form>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>Playback</h2>
        <div className="rounded p-4 text-sm" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <label className="flex items-center justify-between gap-3">
            <div>
              <span style={{ color: "var(--ink)" }}>Auto-scroll</span>
              <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>Scroll chord sheets in sync with playback progress</p>
            </div>
            <input
              type="checkbox"
              checked={prefs?.autoScroll ?? false}
              onChange={toggleAutoScroll}
              disabled={saving || prefs === null}
              className="w-4 h-4"
            />
          </label>
          <label className="flex items-center justify-between gap-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
            <div>
              <span style={{ color: "var(--ink)" }}>Chord diagrams</span>
              <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>Show guitar chord diagrams above chord sheets</p>
            </div>
            <input
              type="checkbox"
              checked={prefs?.showChordDiagrams ?? true}
              onChange={toggleChordDiagrams}
              disabled={saving || prefs === null}
              className="w-4 h-4"
            />
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>About</h2>
        <div className="rounded p-4 text-sm" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--ink-muted)" }}>Version</span>
            <span className="font-mono" style={{ color: "var(--ink)" }}>{process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown"}</span>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>Spotify Permissions</h2>
        <div className="rounded p-4 text-sm" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <p style={{ color: "var(--ink-muted)" }} className="mb-3">
            Playback control shortcuts (space, j/k/l) require additional Spotify permissions.
            If play/pause shortcuts don&apos;t work, re-authenticate to grant them.
          </p>
          <form action="/api/auth/login" method="get">
            <button
              type="submit"
              className="px-4 py-2 rounded text-sm transition-colors"
              style={{ backgroundColor: "var(--accent)", color: "var(--bg)" }}
            >
              Logout &amp; reconnect
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
