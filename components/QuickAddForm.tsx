"use client";

import { useState } from "react";

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
      {error && <div className="text-red-400 text-sm">{error}</div>}
      <button disabled={saving} className="px-4 py-2 rounded bg-green-600 hover:bg-green-500 disabled:opacity-50">
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
