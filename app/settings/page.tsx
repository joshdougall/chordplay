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

  return (
    <div className="p-6 max-w-lg flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wide">Account</h2>
        <div className="bg-neutral-900 rounded p-4 flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-neutral-400">Signed in as</span>
            <span className="text-neutral-200 font-mono">{userId ?? "…"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-400">Library status</span>
            <span className="text-neutral-200">{healthInfo ?? "…"}</span>
          </div>
          <form action="/api/auth/logout" method="post" className="pt-1">
            <button
              type="submit"
              className="px-4 py-2 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm"
            >
              Log out
            </button>
          </form>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wide">Playback</h2>
        <div className="bg-neutral-900 rounded p-4 text-sm">
          <label className="flex items-center justify-between gap-3">
            <div>
              <span className="text-neutral-200">Auto-scroll</span>
              <p className="text-xs text-neutral-500 mt-0.5">Scroll chord sheets in sync with playback progress</p>
            </div>
            <input
              type="checkbox"
              checked={prefs?.autoScroll ?? false}
              onChange={toggleAutoScroll}
              disabled={saving || prefs === null}
              className="w-4 h-4"
            />
          </label>
        </div>
      </section>
    </div>
  );
}
