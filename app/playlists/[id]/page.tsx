"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Track = {
  trackId: string;
  title: string;
  artists: string[];
  albumArt: string | null;
  durationMs: number;
};

type TrackStatus = "unknown" | "in-library" | "importing" | "imported" | "not-found" | "skipped";

type TrackState = Track & {
  status: TrackStatus;
  statusLabel?: string;
};

const STATUS_LABELS: Record<TrackStatus, string> = {
  "unknown": "",
  "in-library": "In library",
  "importing": "Importing…",
  "imported": "Imported",
  "not-found": "No chords found",
  "skipped": "Skipped",
};

export default function PlaylistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [playlistId, setPlaylistId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<TrackState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<{ imported: number; notFound: number; alreadyIn: number } | null>(null);

  useEffect(() => {
    params.then(p => setPlaylistId(p.id));
  }, [params]);

  useEffect(() => {
    if (!playlistId) return;
    setLoading(true);
    fetch(`/api/spotify/playlists/${playlistId}/tracks`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: { tracks: Track[] }) => {
        setTracks(data.tracks.map(t => ({ ...t, status: "unknown" as TrackStatus })));
      })
      .catch(err => setError(`Failed to load tracks (${err})`))
      .finally(() => setLoading(false));
  }, [playlistId]);

  // Check library status for all tracks on load
  useEffect(() => {
    if (tracks.length === 0 || tracks[0].status !== "unknown") return;
    (async () => {
      const updated = await Promise.all(tracks.map(async t => {
        const url = new URL("/api/library/match", window.location.origin);
        url.searchParams.set("track_id", t.trackId);
        url.searchParams.set("title", t.title);
        url.searchParams.set("artist", t.artists.join(", "));
        try {
          const res = await fetch(url);
          if (!res.ok) return t;
          const data = await res.json();
          if (data.match) return { ...t, status: "in-library" as TrackStatus };
        } catch {
          // ignore
        }
        return t;
      }));
      setTracks(updated);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks.length]);

  async function importAll() {
    setImporting(true);
    setSummary(null);
    let imported = 0;
    let notFound = 0;
    let alreadyIn = 0;

    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      if (t.status === "in-library") { alreadyIn++; continue; }

      setTracks(prev => prev.map((x, idx) =>
        idx === i ? { ...x, status: "importing" } : x
      ));

      try {
        const res = await fetch("/api/library/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackId: t.trackId, title: t.title, artists: t.artists })
        });
        const data = await res.json();
        if (!res.ok) {
          setTracks(prev => prev.map((x, idx) =>
            idx === i ? { ...x, status: "skipped" } : x
          ));
          continue;
        }
        if (!data.created && data.libraryId) {
          alreadyIn++;
          setTracks(prev => prev.map((x, idx) =>
            idx === i ? { ...x, status: "in-library" } : x
          ));
        } else if (data.created) {
          imported++;
          setTracks(prev => prev.map((x, idx) =>
            idx === i ? { ...x, status: "imported", statusLabel: `Imported from ${data.source}` } : x
          ));
        } else {
          notFound++;
          setTracks(prev => prev.map((x, idx) =>
            idx === i ? { ...x, status: "not-found" } : x
          ));
        }
      } catch {
        setTracks(prev => prev.map((x, idx) =>
          idx === i ? { ...x, status: "skipped" } : x
        ));
      }

      // Small delay to be polite to external services
      await new Promise(r => setTimeout(r, 300));
    }

    setSummary({ imported, notFound, alreadyIn });
    setImporting(false);
  }

  if (loading) {
    return <div className="p-8" style={{ color: "var(--ink-muted)" }}>Loading tracks…</div>;
  }
  if (error) {
    return <div className="p-8" style={{ color: "var(--danger)" }}>{error}</div>;
  }

  const missingCount = tracks.filter(t => t.status !== "in-library").length;

  const statusColor: Record<TrackStatus, string> = {
    "unknown": "var(--ink-faint)",
    "in-library": "var(--success, #22c55e)",
    "importing": "var(--ink-muted)",
    "imported": "var(--accent)",
    "not-found": "var(--ink-faint)",
    "skipped": "var(--ink-faint)",
  };

  return (
    <div className="p-6 flex flex-col gap-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/playlists" className="text-sm" style={{ color: "var(--ink-faint)" }}>
          ← Playlists
        </Link>
      </div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: "var(--ink)" }}>
          {tracks.length} tracks
        </h1>
        {!importing && (
          <button
            onClick={importAll}
            disabled={missingCount === 0}
            className="px-4 py-2 rounded text-sm transition-colors disabled:opacity-40"
            style={{ backgroundColor: "var(--accent)", color: "var(--bg)" }}
          >
            Import all missing ({missingCount})
          </button>
        )}
        {importing && (
          <span className="text-sm" style={{ color: "var(--ink-muted)" }}>Importing…</span>
        )}
      </div>
      {summary && (
        <div className="rounded p-3 text-sm" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          Import complete: {summary.imported} imported, {summary.notFound} not found, {summary.alreadyIn} already in library.
        </div>
      )}
      <ul className="flex flex-col" style={{ border: "1px solid var(--border)", borderRadius: "0.5rem", overflow: "hidden" }}>
        {tracks.map((t, i) => (
          <li
            key={t.trackId}
            className="flex items-center gap-3 px-3 py-2"
            style={{
              borderBottom: i < tracks.length - 1 ? "1px solid var(--border)" : undefined,
              backgroundColor: "var(--bg-surface)"
            }}
          >
            {t.albumArt && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.albumArt} alt="" className="w-8 h-8 rounded shrink-0 object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: "var(--ink)" }}>{t.title}</div>
              <div className="text-xs truncate" style={{ color: "var(--ink-muted)" }}>{t.artists.join(", ")}</div>
            </div>
            {t.status !== "unknown" && (
              <span className="text-xs shrink-0" style={{ color: statusColor[t.status] }}>
                {t.statusLabel ?? STATUS_LABELS[t.status]}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
