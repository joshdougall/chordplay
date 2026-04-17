"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QuickAddForm, type TrackStub } from "@/components/QuickAddForm";

type LibraryEntry = {
  id: string;
  title: string;
  artist: string;
  format: string;
  spotifyTrackId?: string;
  parseError: boolean;
};

type SpotifyTrack = {
  trackId: string;
  title: string;
  artists: string[];
  albumArt: string | null;
  durationMs: number;
};

export default function LibraryPage() {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [addingTrack, setAddingTrack] = useState<TrackStub | null>(null);

  function fetchEntries() {
    fetch("/api/library/all")
      .then(r => r.json())
      .then(data => setEntries(data.entries ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchEntries(); }, []);

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

  if (addingTrack) {
    return (
      <div className="bg-neutral-950 text-neutral-100">
        <div className="p-4 border-b border-neutral-800 flex items-center gap-3">
          <button
            onClick={() => setAddingTrack(null)}
            className="text-neutral-400 hover:text-neutral-200 text-sm"
          >
            ← Back
          </button>
          <span className="text-neutral-300 text-sm">Add sheet for: {addingTrack.title}</span>
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
    <div className="bg-neutral-950 text-neutral-100">
      <div className="p-4 max-w-3xl mx-auto flex flex-col gap-6">
        {/* Library filter */}
        <section>
          <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-2">Browse</h2>
          <input
            type="search"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter by title or artist…"
            className="w-full bg-neutral-900 rounded px-3 py-2 text-sm placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-600 mb-3"
          />
          {loading ? (
            <div className="text-neutral-400 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-neutral-500 text-sm">{entries.length === 0 ? "No sheets in library." : "No matches."}</div>
          ) : (
            <ul className="divide-y divide-neutral-800">
              {filtered.map(entry => (
                <li key={entry.id}>
                  <Link
                    href={`/library/${encodeURIComponent(entry.id)}`}
                    className="flex items-center gap-3 py-2 px-1 hover:bg-neutral-900 rounded group"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium truncate group-hover:text-white">
                        {entry.title}
                        {entry.parseError && <span className="ml-1 text-xs text-red-400">(parse error)</span>}
                      </span>
                      <span className="block text-xs text-neutral-400 truncate">{entry.artist}</span>
                    </span>
                    <span className="text-xs text-neutral-600 shrink-0">{entry.format}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Spotify search */}
        <section>
          <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-2">Spotify Search</h2>
          <form onSubmit={runSearch} className="flex gap-2 mb-3">
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
          {searchError && <div className="text-red-400 text-sm mb-2">{searchError}</div>}
          {searchResults.length > 0 && (
            <ul className="divide-y divide-neutral-800">
              {searchResults.map(track => {
                const inLibrary = trackIdSet.has(track.trackId);
                const existing = inLibrary ? entries.find(e => e.spotifyTrackId === track.trackId) : null;
                return (
                  <li key={track.trackId} className="flex items-center gap-3 py-2">
                    {track.albumArt && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={track.albumArt} alt="" className="w-10 h-10 rounded shrink-0 object-cover" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{track.title}</div>
                      <div className="text-xs text-neutral-400 truncate">{track.artists.join(", ")}</div>
                    </div>
                    {inLibrary && existing ? (
                      <Link
                        href={`/library/${encodeURIComponent(existing.id)}`}
                        className="shrink-0 text-xs px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                      >
                        Open in library
                      </Link>
                    ) : (
                      <button
                        onClick={() => setAddingTrack({ trackId: track.trackId, title: track.title, artists: track.artists })}
                        className="shrink-0 text-xs px-3 py-1 rounded bg-green-700 hover:bg-green-600 text-white"
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
            <div className="text-neutral-500 text-sm">No results for &ldquo;{searchQuery}&rdquo;.</div>
          )}
        </section>
      </div>
    </div>
  );
}
