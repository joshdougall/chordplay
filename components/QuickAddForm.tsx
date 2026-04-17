"use client";

import { useState, useEffect } from "react";
import type { ExternalChords } from "@/lib/external/provider";

export type TrackStub = {
  trackId: string;
  title: string;
  artists: string[];
};

type SpotifyTrack = {
  trackId: string;
  title: string;
  artists: string[];
  albumArt: string | null;
  durationMs: number;
};

type Props = {
  track?: TrackStub;
  onCreated: (id: string) => void;
};

export function QuickAddForm({ track: initialTrack, onCreated }: Props) {
  const [track, setTrack] = useState<TrackStub | undefined>(initialTrack);

  // Spotify search state (only used when no track provided)
  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState(initialTrack?.title ?? "");
  const [artist, setArtist] = useState(initialTrack?.artists.join(", ") ?? "");
  const [format, setFormat] = useState<"chordpro" | "ascii-tab">("chordpro");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedChords, setSuggestedChords] = useState<ExternalChords | null>(null);
  const [fetchingChords, setFetchingChords] = useState(false);

  // When a track is selected, prefill form fields and fetch chord suggestions
  useEffect(() => {
    if (!track?.title) return;
    setTitle(track.title);
    setArtist(track.artists.join(", "));
    setContent("");
    setSuggestedChords(null);
    setFetchingChords(true);
    const params = new URLSearchParams({ title: track.title, artist: track.artists.join(", ") });
    fetch(`/api/external/chords?${params}`)
      .then(r => r.ok ? r.json() : { match: null })
      .then((body: { match: ExternalChords | null }) => {
        if (body.match) setSuggestedChords(body.match);
      })
      .catch(() => {/* silently ignore */})
      .finally(() => setFetchingChords(false));
  }, [track]);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    setSearchResults([]);
    try {
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}`);
      if (res.status === 401) { setSearchError("Not authenticated with Spotify."); return; }
      if (!res.ok) { setSearchError(`Search failed (${res.status}).`); return; }
      const data = await res.json();
      setSearchResults(data.tracks ?? []);
    } catch (err) {
      setSearchError((err as Error).message);
    } finally {
      setSearching(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, artist, format, content, spotifyTrackId: track?.trackId })
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
    <div className="p-4 flex flex-col gap-4 max-w-2xl">
      {/* Spotify search step when no track is pre-selected */}
      {!initialTrack && (
        <div className="flex flex-col gap-3">
          <p className="text-neutral-400 text-sm">
            Search Spotify to prefill track info and chord suggestions, or fill in the form manually below.
          </p>
          <form onSubmit={runSearch} className="flex gap-2">
            <input
              type="search"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search Spotify…"
              className="flex-1 bg-neutral-900 rounded px-3 py-2 text-sm placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-600"
            />
            <button
              type="submit"
              disabled={searching || !searchInput.trim()}
              className="px-4 py-2 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-sm"
            >
              {searching ? "Searching…" : "Search"}
            </button>
          </form>
          {searchError && <div className="text-red-400 text-sm">{searchError}</div>}
          {searchResults.length > 0 && (
            <ul className="divide-y divide-neutral-800 border border-neutral-800 rounded">
              {searchResults.map(t => (
                <li key={t.trackId}>
                  <button
                    type="button"
                    onClick={() => setTrack({ trackId: t.trackId, title: t.title, artists: t.artists })}
                    className="w-full flex items-center gap-3 py-2 px-3 hover:bg-neutral-900 text-left"
                  >
                    {t.albumArt && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.albumArt} alt="" className="w-8 h-8 rounded shrink-0 object-cover" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{t.title}</div>
                      <div className="text-xs text-neutral-400 truncate">{t.artists.join(", ")}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {track && (
            <div className="text-sm text-neutral-300 bg-neutral-900 rounded px-3 py-2">
              Selected: <span className="font-medium">{track.title}</span> — {track.artists.join(", ")}
              <button
                type="button"
                onClick={() => { setTrack(undefined); setTitle(""); setArtist(""); setSuggestedChords(null); }}
                className="ml-3 text-xs text-neutral-500 hover:text-neutral-300"
              >
                clear
              </button>
            </div>
          )}
          <hr className="border-neutral-800" />
        </div>
      )}

      {/* Add form */}
      <form onSubmit={submit} className="flex flex-col gap-3">
        {initialTrack && (
          <p className="text-neutral-300">No sheet in the library for this track. Add one:</p>
        )}
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
    </div>
  );
}
