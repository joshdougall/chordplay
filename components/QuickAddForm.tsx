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

const inputStyle = {
  backgroundColor: "var(--bg-surface)",
  color: "var(--ink)",
  border: "1px solid var(--border)"
};

const inputFocusClass = "focus:outline-none focus:ring-1 focus:ring-[var(--accent)/40]";

export function QuickAddForm({ track: initialTrack, onCreated }: Props) {
  const [track, setTrack] = useState<TrackStub | undefined>(initialTrack);

  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [title, setTitle] = useState(initialTrack?.title ?? "");
  const [artist, setArtist] = useState(initialTrack?.artists.join(", ") ?? "");
  const [format, setFormat] = useState<"chordpro" | "ascii-tab">("chordpro");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedChords, setSuggestedChords] = useState<ExternalChords | null>(null);
  const [fetchingChords, setFetchingChords] = useState(false);

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
      {!initialTrack && (
        <div className="flex flex-col gap-3">
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            Search Spotify to prefill track info and chord suggestions, or fill in the form manually below.
          </p>
          <form onSubmit={runSearch} className="flex gap-2">
            <input
              type="search"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search Spotify…"
              className={`flex-1 rounded px-3 py-2 text-sm ${inputFocusClass}`}
              style={{ ...inputStyle, outlineColor: "transparent" }}
            />
            <button
              type="submit"
              disabled={searching || !searchInput.trim()}
              className="px-4 py-2 rounded text-sm disabled:opacity-40 transition-colors"
              style={{ backgroundColor: "var(--bg-alt)", color: "var(--ink-muted)" }}
            >
              {searching ? "Searching…" : "Search"}
            </button>
          </form>
          {searchError && <div className="text-sm" style={{ color: "var(--danger)" }}>{searchError}</div>}
          {searchResults.length > 0 && (
            <ul className="rounded overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              {searchResults.map(t => (
                <li key={t.trackId} style={{ borderBottom: "1px solid var(--border)" }}>
                  <button
                    type="button"
                    onClick={() => setTrack({ trackId: t.trackId, title: t.title, artists: t.artists })}
                    className="w-full flex items-center gap-3 py-2 px-3 text-left transition-colors"
                    style={{ color: "var(--ink)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-alt)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = ""; }}
                  >
                    {t.albumArt && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.albumArt} alt="" className="w-8 h-8 rounded shrink-0 object-cover" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{t.title}</div>
                      <div className="text-xs truncate" style={{ color: "var(--ink-muted)" }}>{t.artists.join(", ")}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {track && (
            <div className="text-sm rounded px-3 py-2" style={{ backgroundColor: "var(--bg-surface)", color: "var(--ink-muted)" }}>
              Selected: <span className="font-medium" style={{ color: "var(--ink)" }}>{track.title}</span> — {track.artists.join(", ")}
              <button
                type="button"
                onClick={() => { setTrack(undefined); setTitle(""); setArtist(""); setSuggestedChords(null); }}
                className="ml-3 text-xs transition-colors"
                style={{ color: "var(--ink-faint)" }}
              >
                clear
              </button>
            </div>
          )}
          <hr style={{ borderColor: "var(--border)" }} />
        </div>
      )}

      <form onSubmit={submit} className="flex flex-col gap-3">
        {initialTrack && (
          <p style={{ color: "var(--ink-muted)" }}>No sheet in the library for this track. Add one:</p>
        )}
        <label className="flex flex-col text-sm" style={{ color: "var(--ink-muted)" }}>Title
          <input
            className={`rounded p-2 mt-1 ${inputFocusClass}`}
            style={{ ...inputStyle, color: "var(--ink)" }}
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </label>
        <label className="flex flex-col text-sm" style={{ color: "var(--ink-muted)" }}>Artist
          <input
            className={`rounded p-2 mt-1 ${inputFocusClass}`}
            style={{ ...inputStyle, color: "var(--ink)" }}
            value={artist}
            onChange={e => setArtist(e.target.value)}
          />
        </label>
        <label className="flex flex-col text-sm" style={{ color: "var(--ink-muted)" }}>Format
          <select
            className={`rounded p-2 mt-1 ${inputFocusClass}`}
            style={{ ...inputStyle, color: "var(--ink)" }}
            value={format}
            onChange={e => setFormat(e.target.value as "chordpro" | "ascii-tab")}
          >
            <option value="chordpro">ChordPro</option>
            <option value="ascii-tab">ASCII tab</option>
          </select>
        </label>
        <label className="flex flex-col text-sm" style={{ color: "var(--ink-muted)" }}>Content
          <textarea
            className={`rounded p-2 mt-1 min-h-64 ${inputFocusClass}`}
            style={{ ...inputStyle, color: "var(--ink)", fontFamily: "var(--font-mono-brand, monospace)" }}
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={format === "chordpro" ? "[C]Hey [G]Jude..." : "e|---0---3---5---"}
          />
        </label>
        {fetchingChords && (
          <span className="text-sm" style={{ color: "var(--ink-muted)" }}>Fetching chord suggestions…</span>
        )}
        {!fetchingChords && suggestedChords && (
          <div className="flex items-center gap-3 text-sm">
            <button
              type="button"
              onClick={() => setContent(suggestedChords.content)}
              className="px-3 py-1 rounded transition-colors"
              style={{ backgroundColor: "var(--bg-alt)", color: "var(--ink)" }}
            >
              Use suggested chords from {suggestedChords.sourceName}
            </button>
            <a
              href={suggestedChords.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs underline transition-colors"
              style={{ color: "var(--ink-muted)" }}
            >
              view source
            </a>
          </div>
        )}
        {error && <div className="text-sm" style={{ color: "var(--danger)" }}>{error}</div>}
        <button
          disabled={saving}
          className="px-4 py-2 rounded transition-colors disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)", color: "var(--bg)" }}
          onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent-hover)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent)"; }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
