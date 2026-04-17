"use client";

import { useEffect, useRef, useState } from "react";
import { useNowPlaying } from "@/hooks/useNowPlaying";
import { NowPlayingHeader } from "@/components/NowPlayingHeader";
import { ConnectSpotify } from "@/components/ConnectSpotify";
import { ChordProView } from "@/components/ChordProView";
import { TabView } from "@/components/TabView";
import { AutoScroller } from "@/components/AutoScroller";
import { QuickAddForm } from "@/components/QuickAddForm";
import { Editor } from "@/components/Editor";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { ShortcutsHelp } from "@/components/ShortcutsHelp";
import type { LibraryEntry } from "@/lib/library/index";
import type { Prefs } from "@/lib/prefs/store";

type MatchResponse = { match: LibraryEntry | null; confidence: "exact" | "fuzzy" | null; score?: number };

type LastPlayedTrack = {
  trackId: string;
  title: string;
  artists: string[];
  albumArt: string | null;
  durationMs: number;
  playedAt: string;
};

const btnStyle = {
  backgroundColor: "var(--bg-surface)",
  color: "var(--ink-muted)",
  border: "1px solid var(--border)"
};

export default function HomePage() {
  const np = useNowPlaying();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [matchResp, setMatchResp] = useState<MatchResponse | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [editing, setEditing] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [dismissedTrackId, setDismissedTrackId] = useState<string | null>(null);
  const [lastPlayed, setLastPlayed] = useState<LastPlayedTrack | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetch("/api/prefs").then(r => r.json()).then(setPrefs); }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/status");
      const body = await res.json().catch(() => ({ authenticated: false }));
      setConnected(!!body.authenticated);
    })();
  }, []);

  // Fetch last-played when Spotify is idle
  useEffect(() => {
    if (np.data !== null) {
      setLastPlayed(null);
      return;
    }
    if (np.data === null) {
      fetch("/api/spotify/recently-played")
        .then(r => r.ok ? r.json() : { tracks: [] })
        .then((body: { tracks: LastPlayedTrack[] }) => {
          if (body.tracks?.[0]) setLastPlayed(body.tracks[0]);
        })
        .catch(() => {});
    }
  }, [np.data]);

  // Effective track for matching: live playback or last-played fallback
  const effectiveTrack = np.data ?? (lastPlayed ? {
    trackId: lastPlayed.trackId,
    title: lastPlayed.title,
    artists: lastPlayed.artists,
    albumArt: lastPlayed.albumArt,
    durationMs: lastPlayed.durationMs,
    progressMs: 0,
    isPlaying: false,
  } : null);

  const trackId = effectiveTrack?.trackId;
  useEffect(() => {
    // Reset dismissed state when track changes
    setDismissedTrackId(prev => {
      if (prev && prev !== trackId) return null;
      return prev;
    });

    if (!trackId || !effectiveTrack) { setMatchResp(null); setContent(null); return; }
    (async () => {
      const url = new URL("/api/library/match", window.location.origin);
      url.searchParams.set("track_id", trackId);
      url.searchParams.set("title", effectiveTrack.title);
      url.searchParams.set("artist", effectiveTrack.artists.join(", "));
      const res = await fetch(url);
      if (!res.ok) return;
      const data = (await res.json()) as MatchResponse;
      setMatchResp(data);
      if (data.match) {
        // Silently bake in spotify_track_id for exact-by-key matches that don't have it yet
        if (data.confidence === "exact" && !data.match.spotifyTrackId) {
          fetch(`/api/library/${encodeURIComponent(data.match.id)}/spotify-track`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ trackId })
          }).catch(() => {});
        }

        const r = await fetch(`/api/library/${encodeURIComponent(data.match.id)}`);
        if (r.ok) {
          const { content: c } = await r.json();
          setContent(c);
        }
      } else {
        setContent(null);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId]);

  const currentId = matchResp?.match?.id;
  const transposeOffset: number = (currentId ? (prefs?.songTranspose?.[currentId] ?? 0) : 0);

  // Determine if current match should be shown (respect dismissal)
  const effectiveMatch = (matchResp?.match && matchResp.match.id !== dismissedTrackId && dismissedTrackId !== trackId)
    ? matchResp.match
    : null;

  async function toggleAutoScroll() {
    if (!prefs) return;
    const next = { ...prefs, autoScroll: !prefs.autoScroll };
    setPrefs(next);
    await fetch("/api/prefs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
  }

  async function setTranspose(n: number) {
    if (!prefs || !currentId) return;
    const next = { ...prefs, songTranspose: { ...prefs.songTranspose, [currentId]: n } };
    setPrefs(next);
    await fetch("/api/prefs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
  }

  async function playbackAction(action: "toggle" | "next" | "previous") {
    setPlaybackError(null);
    try {
      const res = await fetch(`/api/spotify/playback?action=${action}`, { method: "POST" });
      if (res.status === 403) {
        setPlaybackError("Playback control requires re-authentication. Visit Settings to reconnect.");
      }
    } catch {
      // silently ignore network errors
    }
  }

  async function lockFuzzyMatch() {
    if (!matchResp?.match || !trackId) return;
    const matchId = matchResp.match.id;
    // Update prefs
    const newPrefs = {
      ...prefs,
      trackOverrides: { ...(prefs?.trackOverrides ?? {}), [trackId]: matchId }
    };
    await fetch("/api/prefs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newPrefs) });
    setPrefs(newPrefs as Prefs);
    // Bake in spotify_track_id
    fetch(`/api/library/${encodeURIComponent(matchId)}/spotify-track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackId })
    }).catch(() => {});
    // Update local match to exact
    setMatchResp({ ...matchResp, confidence: "exact", score: undefined });
  }

  useKeyboardShortcuts({
    " ": () => playbackAction("toggle"),
    "k": () => playbackAction("toggle"),
    "j": () => playbackAction("previous"),
    "ArrowLeft": () => playbackAction("previous"),
    "l": () => playbackAction("next"),
    "ArrowRight": () => playbackAction("next"),
    "t": () => setTranspose(transposeOffset + 1),
    "Shift+T": () => setTranspose(transposeOffset - 1),
    "0": () => setTranspose(0),
    "a": () => toggleAutoScroll(),
    "e": () => { if (effectiveMatch) setEditing(e => !e); },
    "?": () => setShowShortcuts(s => !s),
  });

  if (connected === false) return <ConnectSpotify />;
  if (connected === null) return <div className="p-8" style={{ color: "var(--ink-muted)" }}>Loading…</div>;

  const isLastPlayed = np.data === null && lastPlayed !== null;

  return (
    <div className="flex flex-col h-full">
      <NowPlayingHeader data={np.data ?? (lastPlayed ? {
        trackId: lastPlayed.trackId,
        title: lastPlayed.title,
        artists: lastPlayed.artists,
        albumArt: lastPlayed.albumArt,
        durationMs: lastPlayed.durationMs,
        progressMs: 0,
        isPlaying: false,
      } : null)} isLastPlayed={isLastPlayed} lastPlayedAt={lastPlayed?.playedAt} />
      {playbackError && (
        <div className="px-4 py-2 text-sm flex items-center justify-between" style={{ backgroundColor: "var(--bg-surface)", color: "var(--danger)", borderBottom: "1px solid var(--border)" }}>
          <span>{playbackError}</span>
          <button onClick={() => setPlaybackError(null)} style={{ color: "var(--ink-faint)" }}>✕</button>
        </div>
      )}
      <div className="p-2 flex items-center gap-3 text-sm flex-wrap" style={{ borderBottom: "1px solid var(--border)" }}>
        <label className="flex items-center gap-2" style={{ color: "var(--ink-muted)" }}>
          <input type="checkbox" checked={prefs?.autoScroll ?? false} onChange={toggleAutoScroll} />
          Auto-scroll
        </label>
        {effectiveMatch && effectiveMatch.format === "chordpro" && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTranspose(transposeOffset - 1)}
              className="px-2 py-1 rounded"
              style={btnStyle}
              aria-label="Transpose down"
            >−</button>
            <span className="w-8 text-center tabular-nums" style={{ color: "var(--ink-muted)" }}>
              {transposeOffset > 0 ? `+${transposeOffset}` : transposeOffset === 0 ? "±0" : `${transposeOffset}`}
            </span>
            <button
              onClick={() => setTranspose(transposeOffset + 1)}
              className="px-2 py-1 rounded"
              style={btnStyle}
              aria-label="Transpose up"
            >+</button>
            {transposeOffset !== 0 && (
              <button
                onClick={() => setTranspose(0)}
                className="px-2 py-1 rounded"
                style={btnStyle}
              >Reset</button>
            )}
          </div>
        )}
        {effectiveMatch && (
          <>
            {matchResp?.confidence === "fuzzy" && (
              <span style={{ color: "var(--ink-faint)" }}>
                (fuzzy {Math.round((matchResp.score ?? 0) * 100)}%)
              </span>
            )}
            {matchResp?.confidence === "fuzzy" && (
              <>
                <button
                  onClick={() => setDismissedTrackId(trackId ?? null)}
                  className="px-2 py-1 rounded text-xs"
                  style={btnStyle}
                  title="Wrong match — show add form instead"
                >
                  wrong match
                </button>
                <button
                  onClick={lockFuzzyMatch}
                  className="px-2 py-1 rounded text-xs"
                  style={{ ...btnStyle, color: "var(--accent)" }}
                  title="Confirm this is the correct match"
                >
                  this is correct
                </button>
              </>
            )}
            <button onClick={() => setEditing(true)} className="px-2 py-1 rounded" style={btnStyle}>
              Edit
            </button>
          </>
        )}
        <button
          onClick={() => setShowShortcuts(true)}
          className="ml-auto px-2 py-1 rounded text-xs"
          style={{ color: "var(--ink-faint)" }}
          title="Keyboard shortcuts"
        >
          ?
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto">
        {editing && effectiveMatch ? (
          <Editor id={effectiveMatch.id} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />
        ) : effectiveMatch && content !== null ? (
          renderEntry(effectiveMatch, content, transposeOffset, prefs?.showChordDiagrams ?? true)
        ) : effectiveTrack ? (
          <QuickAddForm track={effectiveTrack} onCreated={() => { /* next poll refetches */ }} />
        ) : (
          <div className="p-4" style={{ color: "var(--ink-muted)" }}>Waiting for Spotify…</div>
        )}
      </div>
      {np.data && prefs && (
        <AutoScroller
          enabled={prefs.autoScroll && !editing}
          progressMs={np.data.progressMs}
          durationMs={np.data.durationMs}
          targetRef={scrollRef}
        />
      )}
      {showShortcuts && <ShortcutsHelp onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}

function renderEntry(entry: LibraryEntry, content: string, transpose = 0, showChordDiagrams = true) {
  if (entry.format === "chordpro") return <ChordProView source={content} transpose={transpose} showChordDiagrams={showChordDiagrams} />;
  if (entry.format === "ascii-tab") return <TabView kind="ascii" text={content} />;
  return <TabView kind="guitar-pro" src={`/api/library/raw/${encodeURIComponent(entry.id)}`} />;
}
