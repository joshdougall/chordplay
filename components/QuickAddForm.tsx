"use client";

import { useState, useEffect } from "react";
import type { ExternalChords } from "@/lib/external/provider";

export type TrackStub = {
  trackId: string;
  title: string;
  artists: string[];
};

export function QuickAddForm({ track, onCreated }: { track: TrackStub; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState(track.title);
  const [artist, setArtist] = useState(track.artists.join(", "));
  const [format, setFormat] = useState<"chordpro" | "ascii-tab">("chordpro");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedChords, setSuggestedChords] = useState<ExternalChords | null>(null);
  const [fetchingChords, setFetchingChords] = useState(false);

  useEffect(() => {
    if (!track.title) return;
    setFetchingChords(true);
    setSuggestedChords(null);
    const params = new URLSearchParams({ title: track.title, artist: track.artists.join(", ") });
    fetch(`/api/external/chords?${params}`)
      .then(r => r.ok ? r.json() : { match: null })
      .then((body: { match: ExternalChords | null }) => {
        if (body.match) setSuggestedChords(body.match);
      })
      .catch(() => {/* silently ignore */})
      .finally(() => setFetchingChords(false));
  }, [track.title, track.artists]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, artist, format, content, spotifyTrackId: track.trackId })
      });
      if (!res.ok) throw new Error(await res.text());
      const { id } = await res.json();
      onCreated(id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="p-4 flex flex-col gap-3 max-w-2xl">
      <p className="text-neutral-300">No sheet in the library for this track. Add one:</p>
      <label className="flex flex-col text-sm">Title
        <input className="bg-neutral-900 p-2 rounded" value={title} onChange={e => setTitle(e.target.value)} />
      </label>
      <label className="flex flex-col text-sm">Artist
        <input className="bg-neutral-900 p-2 rounded" value={artist} onChange={e => setArtist(e.target.value)} />
      </label>
      <label className="flex flex-col text-sm">Format
        <select className="bg-neutral-900 p-2 rounded" value={format} onChange={e => setFormat(e.target.value as "chordpro" | "ascii-tab")}>
          <option value="chordpro">ChordPro</option>
          <option value="ascii-tab">ASCII tab</option>
        </select>
      </label>
      <label className="flex flex-col text-sm">Content
        <textarea
          className="bg-neutral-900 p-2 rounded font-mono min-h-64"
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={format === "chordpro" ? "[C]Hey [G]Jude..." : "e|---0---3---5---"}
        />
      </label>
      {fetchingChords && (
        <span className="text-sm text-neutral-400">Fetching chord suggestions…</span>
      )}
      {!fetchingChords && suggestedChords && (
        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => setContent(suggestedChords.content)}
            className="px-3 py-1 rounded bg-neutral-700 hover:bg-neutral-600 text-neutral-100"
          >
            Use suggested chords from {suggestedChords.sourceName}
          </button>
          <a
            href={suggestedChords.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-neutral-400 hover:text-neutral-200 underline"
          >
            view source
          </a>
        </div>
      )}
      {error && <div className="text-red-400 text-sm">{error}</div>}
      <button disabled={saving} className="px-4 py-2 rounded bg-green-600 hover:bg-green-500 disabled:opacity-50">
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
