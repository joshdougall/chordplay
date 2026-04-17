"use client";

import { useState, useEffect } from "react";
import { ChordProView } from "@/components/ChordProView";
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

  // Sync internal track when the parent passes a new initialTrack (e.g., Spotify track changed on /).
  useEffect(() => {
    if (initialTrack && initialTrack.trackId !== track?.trackId) {
      setTrack(initialTrack);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTrack?.trackId]);

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
  // Edit mode: when false, render preview. Default false when auto-fill succeeds, true when user starts typing.
  const [editMode, setEditMode] = useState(!initialTrack);

  useEffect(() => {
    if (!track?.title) return;
    setTitle(track.title);
    setArtist(track.artists.join(", "));
    setContent("");
    setSuggestedChords(null);
    setFetchingChords(true);
    setEditMode(false);  // Switch to preview mode while fetching; we'll stay in preview if fetch succeeds
    const params = new URLSearchParams({ title: track.title, artist: track.artists.join(", ") });
    fetch(`/api/external/chords?${params}`)
      .then(r => r.ok ? r.json() : { match: null })
      .then((body: { match: ExternalChords | null }) => {
        if (body.match) {
          setSuggestedChords(body.match);
          setContent(prev => prev.trim() === "" ? body.match!.content : prev);
          // Stay in preview mode — user sees rendered chords, can click Edit to tweak
        } else {
          // No auto-fill — give the user a textarea to type
          setEditMode(true);
        }
      })
      .catch(() => setEditMode(true))
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

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
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

  const hasPreviewableContent = !editMode && content.trim() !== "" && format === "chordpro";

  return (
    <div className="p-4 flex flex-col gap-4 max-w-3xl mx-auto">
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
                onClick={() => { setTrack(undefined); setTitle(""); setArtist(""); setSuggestedChords(null); setContent(""); setEditMode(true); }}
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

      {/* Prominent save bar with status — always visible at the top when we have a track */}
      {track && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 py-2 px-3 rounded"
             style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <div className="flex-1 min-w-0 text-sm">
            <div className="font-medium truncate" style={{ color: "var(--ink)" }}>{title || track.title}</div>
            <div className="text-xs truncate" style={{ color: "var(--ink-muted)" }}>
              {artist || track.artists.join(", ")}
              {fetchingChords && " · Fetching chords…"}
              {!fetchingChords && suggestedChords && ` · Auto-filled from ${suggestedChords.sourceName}`}
              {!fetchingChords && !suggestedChords && " · No chords found online — type or paste below"}
            </div>
          </div>
          {hasPreviewableContent && (
            <button
              type="button"
              onClick={() => setEditMode(true)}
              className="px-3 py-1.5 rounded text-xs transition-colors"
              style={{ backgroundColor: "var(--bg-alt)", color: "var(--ink-muted)", border: "1px solid var(--border)" }}
            >
              Edit
            </button>
          )}
          <button
            type="button"
            onClick={() => submit()}
            disabled={saving || !content.trim()}
            className="px-4 py-1.5 rounded text-sm disabled:opacity-40 transition-colors"
            style={{ backgroundColor: "var(--accent)", color: "var(--bg)" }}
            onMouseEnter={e => { if (!saving && content.trim()) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent-hover)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent)"; }}
          >
            {saving ? "Saving…" : "Save to library"}
          </button>
        </div>
      )}

      {error && <div className="text-sm" style={{ color: "var(--danger)" }}>{error}</div>}

      {/* Preview: rendered chord sheet */}
      {hasPreviewableContent && (
        <div className="rounded" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <ChordProView source={content} />
        </div>
      )}

      {/* Edit mode: title/artist/format/content form */}
      {editMode && (
        <form onSubmit={submit} className="flex flex-col gap-3">
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
              className={`rounded p-2 mt-1 min-h-96 ${inputFocusClass}`}
              style={{ ...inputStyle, color: "var(--ink)", fontFamily: "var(--font-mono-brand, monospace)" }}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={format === "chordpro" ? "[C]Hey [G]Jude..." : "e|---0---3---5---"}
            />
          </label>
          {suggestedChords && (
            <div className="flex items-center gap-3 text-xs" style={{ color: "var(--ink-muted)" }}>
              <button
                type="button"
                onClick={() => setContent(suggestedChords.content)}
                className="underline"
                style={{ color: "var(--ink-muted)" }}
              >
                re-fill from {suggestedChords.sourceName}
              </button>
              <a
                href={suggestedChords.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
                style={{ color: "var(--ink-muted)" }}
              >
                view source
              </a>
              {track && hasPreviewableContent === false && content.trim() !== "" && format === "chordpro" && (
                <button
                  type="button"
                  onClick={() => setEditMode(false)}
                  className="underline ml-auto"
                  style={{ color: "var(--ink-muted)" }}
                >
                  preview
                </button>
              )}
            </div>
          )}
          {/* Back to preview when in edit mode and preview is available */}
          {track && content.trim() !== "" && format === "chordpro" && !hasPreviewableContent && (
            <button
              type="button"
              onClick={() => setEditMode(false)}
              className="text-xs underline self-start"
              style={{ color: "var(--ink-muted)" }}
            >
              ← back to preview
            </button>
          )}
        </form>
      )}
    </div>
  );
}
