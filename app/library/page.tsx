"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { QuickAddForm, type TrackStub } from "@/components/QuickAddForm";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { ShortcutsHelp } from "@/components/ShortcutsHelp";
import { Skeleton } from "@/components/Skeleton";

type LibraryEntry = {
  id: string;
  title: string;
  artist: string;
  format: string;
  spotifyTrackId?: string;
  parseError: boolean;
  albumArt?: string;
};

type SpotifyTrack = {
  trackId: string;
  title: string;
  artists: string[];
  albumArt: string | null;
  durationMs: number;
};

function AlbumArtPlaceholder({ title }: { title: string }) {
  const letters = title.trim().slice(0, 2).toUpperCase();
  return (
    <div
      className="w-full aspect-square flex items-center justify-center text-lg font-semibold"
      style={{ backgroundColor: "var(--bg-alt)", color: "var(--accent)" }}
    >
      {letters}
    </div>
  );
}

function LibraryCard({ entry }: { entry: LibraryEntry }) {
  return (
    <Link
      href={`/library/${encodeURIComponent(entry.id)}`}
      className="block rounded-lg overflow-hidden transition-transform hover:-translate-y-0.5 group"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.3)"
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 4px rgba(0,0,0,0.3)";
      }}
    >
      <div className="w-full aspect-square overflow-hidden">
        {entry.albumArt ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.albumArt} alt="" className="w-full h-full object-cover" />
        ) : (
          <AlbumArtPlaceholder title={entry.title} />
        )}
      </div>
      <div className="p-2">
        <div className="text-sm font-medium truncate" style={{ color: "var(--ink)" }}>
          {entry.title}
          {entry.parseError && <span className="ml-1 text-xs" style={{ color: "var(--danger)" }}>(err)</span>}
        </div>
        <div className="text-xs truncate mt-0.5" style={{ color: "var(--ink-muted)" }}>{entry.artist}</div>
        <div className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>{entry.format}</div>
      </div>
    </Link>
  );
}

export default function LibraryPage() {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const filterRef = useRef<HTMLInputElement>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [addingTrack, setAddingTrack] = useState<TrackStub | null>(null);

  function fetchEntries() {
    fetch("/api/library/all")
      .then(r => r.json())
      .then(async (data) => {
        const rawEntries: LibraryEntry[] = data.entries ?? [];
        setEntries(rawEntries);
        // Fetch album art for entries with spotifyTrackId, in batches of 50
        const withSpotify = rawEntries.filter(e => e.spotifyTrackId);
        if (withSpotify.length === 0) return;
        const batches: LibraryEntry[][] = [];
        for (let i = 0; i < withSpotify.length; i += 50) {
          batches.push(withSpotify.slice(i, i + 50));
        }
        const artMap = new Map<string, string>();
        await Promise.all(
          batches.map(async batch => {
            const ids = batch.map(e => e.spotifyTrackId!).join(",");
            try {
              const res = await fetch(`/api/spotify/tracks?ids=${encodeURIComponent(ids)}`);
              if (!res.ok) return;
              const payload = await res.json();
              for (const t of (payload.tracks ?? [])) {
                if (t.albumArt) artMap.set(t.id, t.albumArt);
              }
            } catch {
              // silently ignore
            }
          })
        );
        if (artMap.size === 0) return;
        setEntries(prev => prev.map(e =>
          e.spotifyTrackId && artMap.has(e.spotifyTrackId)
            ? { ...e, albumArt: artMap.get(e.spotifyTrackId) }
            : e
        ));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchEntries(); }, []);

  useKeyboardShortcuts({
    "/": () => { filterRef.current?.focus(); },
    "?": () => setShowShortcuts(s => !s),
  });

  const trackIdSet = new Set(entries.map(e => e.spotifyTrackId).filter(Boolean));

  const filtered = entries.filter(e => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return e.title.toLowerCase().includes(q) || e.artist.toLowerCase().includes(q);
  });

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    setSearchQuery(q);
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

  const inputStyle = {
    backgroundColor: "var(--bg-surface)",
    color: "var(--ink)",
    border: "1px solid var(--border)"
  };

  if (addingTrack) {
    return (
      <div style={{ backgroundColor: "var(--bg)" }}>
        <div className="p-4 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <button
            onClick={() => setAddingTrack(null)}
            className="text-sm transition-colors"
            style={{ color: "var(--ink-muted)" }}
          >
            ← Back
          </button>
          <span className="text-sm" style={{ color: "var(--ink-muted)" }}>Add sheet for: {addingTrack.title}</span>
        </div>
        <QuickAddForm
          track={addingTrack}
          onCreated={() => {
            fetchEntries();
            setAddingTrack(null);
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "var(--bg)", color: "var(--ink)" }}>
      <div className="p-4 max-w-5xl mx-auto flex flex-col gap-6">
        {/* Library filter */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>Browse</h2>
            <button
              onClick={() => setShowShortcuts(true)}
              className="text-xs"
              style={{ color: "var(--ink-faint)" }}
              title="Keyboard shortcuts"
            >
              ?
            </button>
          </div>
          <input
            ref={filterRef}
            type="search"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter by title or artist… (press / to focus)"
            className="w-full rounded px-3 py-2 text-sm focus:outline-none mb-4"
            style={{ ...inputStyle }}
          />
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  <Skeleton style={{ width: "100%", aspectRatio: "1 / 1", borderRadius: 0 }} />
                  <div className="p-2 flex flex-col gap-2">
                    <Skeleton style={{ height: "0.875rem", width: "75%" }} />
                    <Skeleton style={{ height: "0.75rem", width: "50%" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-sm" style={{ color: "var(--ink-faint)" }}>
              {entries.length === 0 ? (
                <span>
                  No sheets yet. Play something on Spotify to get started, or{" "}
                  <a href="/add" className="underline" style={{ color: "var(--accent)" }}>add one manually</a>.
                </span>
              ) : "No matches."}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filtered.map(entry => (
                <LibraryCard key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </section>

        {/* Spotify search */}
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide mb-2" style={{ color: "var(--ink-faint)" }}>Spotify Search</h2>
          <form onSubmit={runSearch} className="flex gap-2 mb-3">
            <input
              type="search"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search Spotify…"
              className="flex-1 rounded px-3 py-2 text-sm focus:outline-none"
              style={inputStyle}
            />
            <button
              type="submit"
              disabled={searching || !searchInput.trim()}
              className="px-4 py-2 rounded text-sm disabled:opacity-40 transition-colors"
              style={{ backgroundColor: "var(--bg-alt)", color: "var(--ink-muted)", border: "1px solid var(--border)" }}
            >
              {searching ? "Searching…" : "Search"}
            </button>
          </form>
          {searchError && <div className="text-sm mb-2" style={{ color: "var(--danger)" }}>{searchError}</div>}
          {searchResults.length > 0 && (
            <ul>
              {searchResults.map(track => {
                const inLibrary = trackIdSet.has(track.trackId);
                const existing = inLibrary ? entries.find(e => e.spotifyTrackId === track.trackId) : null;
                return (
                  <li key={track.trackId} className="flex items-center gap-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
                    {track.albumArt ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={track.albumArt} alt="" className="w-10 h-10 rounded shrink-0 object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded shrink-0 flex items-center justify-center text-xs font-semibold" style={{ backgroundColor: "var(--bg-alt)", color: "var(--accent)" }}>
                        {track.title.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: "var(--ink)" }}>{track.title}</div>
                      <div className="text-xs truncate" style={{ color: "var(--ink-muted)" }}>{track.artists.join(", ")}</div>
                    </div>
                    {inLibrary && existing ? (
                      <Link
                        href={`/library/${encodeURIComponent(existing.id)}`}
                        className="shrink-0 text-xs px-3 py-1 rounded transition-colors"
                        style={{ backgroundColor: "var(--bg-alt)", color: "var(--ink-muted)", border: "1px solid var(--border)" }}
                      >
                        Open in library
                      </Link>
                    ) : (
                      <button
                        onClick={() => setAddingTrack({ trackId: track.trackId, title: track.title, artists: track.artists })}
                        className="shrink-0 text-xs px-3 py-1 rounded transition-colors"
                        style={{ backgroundColor: "var(--accent)", color: "var(--bg)" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent-hover)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent)"; }}
                      >
                        Add sheet
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {!searching && searchQuery && searchResults.length === 0 && !searchError && (
            <div className="text-sm" style={{ color: "var(--ink-faint)" }}>No results for &ldquo;{searchQuery}&rdquo;.</div>
          )}
        </section>
      </div>
      {showShortcuts && <ShortcutsHelp onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}
