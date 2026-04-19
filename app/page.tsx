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
import { LibraryPicker } from "@/components/LibraryPicker";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { OverflowMenu } from "@/components/OverflowMenu";
import { ShortcutsHelp } from "@/components/ShortcutsHelp";
import type { LibraryEntry } from "@/lib/library/index";
import type { Prefs } from "@/lib/prefs/store";

type MatchResponse = {
  match: LibraryEntry | null;
  allMatches?: LibraryEntry[];
  confidence: "exact" | "fuzzy" | null;
  score?: number;
};

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
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [duplicatingVersion, setDuplicatingVersion] = useState(false);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [splitView, setSplitView] = useState(false);
  const [tabContent, setTabContent] = useState<string | null>(null);
  const [chordContent, setChordContent] = useState<string | null>(null);
  // Bump to force a refetch of the library match (e.g., after saving a new sheet from QuickAddForm)
  const [matchRefetch, setMatchRefetch] = useState(0);
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
    fetch("/api/spotify/recently-played")
      .then(r => r.ok ? r.json() : { tracks: [] })
      .then((body: { tracks: LastPlayedTrack[] }) => {
        if (body.tracks?.[0]) setLastPlayed(body.tracks[0]);
      })
      .catch(() => {});
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
    setSelectedVersionId(null);

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

        // Check for preferred version
        let entryToLoad = data.match;
        if (data.allMatches && data.allMatches.length > 1 && prefs?.preferredVersion) {
          const preferredId = prefs.preferredVersion[data.match.songKey];
          const preferred = preferredId ? data.allMatches.find(e => e.id === preferredId) : null;
          if (preferred) entryToLoad = preferred;
        }

        const r = await fetch(`/api/library/${encodeURIComponent(entryToLoad.id)}`);
        if (r.ok) {
          const { content: c } = await r.json();
          setContent(c);
        }
      } else {
        setContent(null);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId, matchRefetch]);

  // Load content when version is explicitly selected
  useEffect(() => {
    if (!selectedVersionId) return;
    fetch(`/api/library/${encodeURIComponent(selectedVersionId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setContent(data.content); })
      .catch(() => {});
  }, [selectedVersionId]);

  const currentEntry = selectedVersionId
    ? matchResp?.allMatches?.find(e => e.id === selectedVersionId) ?? matchResp?.match
    : matchResp?.match;
  const currentId = currentEntry?.id;
  const transposeOffset: number = (currentId ? (prefs?.songTranspose?.[currentId] ?? 0) : 0);

  // Detect if split view is available: song has both a chordpro version and a tab version
  const allMatches = matchResp?.allMatches ?? (matchResp?.match ? [matchResp.match] : []);
  const matchFormats = new Set(allMatches.map(e => e.format));
  const canSplit = matchFormats.size > 1 && matchFormats.has("chordpro") && (matchFormats.has("ascii-tab") || matchFormats.has("guitar-pro"));

  // Chord pane entry: prefer chordpro version (or selected version if it's chordpro)
  const chordEntry = canSplit
    ? (currentEntry?.format === "chordpro" ? currentEntry : allMatches.find(e => e.format === "chordpro"))
    : null;
  // Tab pane entry: first ascii-tab or guitar-pro entry
  const tabEntry = canSplit
    ? allMatches.find(e => e.format === "ascii-tab" || e.format === "guitar-pro")
    : null;

  const songKey = matchResp?.match?.songKey;

  // Determine if current match should be shown (respect dismissal)
  const effectiveMatch = (matchResp?.match && dismissedTrackId !== trackId) ? currentEntry ?? null : null;

  // Restore split-view preference when song changes
  useEffect(() => {
    if (!songKey || !prefs) return;
    setSplitView(prefs.splitView?.[songKey] ?? false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songKey]);

  // Load tab pane content when split is enabled
  useEffect(() => {
    if (!splitView || !tabEntry) { setTabContent(null); return; }
    if (tabEntry.format === "guitar-pro") { setTabContent(null); return; } // guitar-pro uses src URL directly
    fetch(`/api/library/${encodeURIComponent(tabEntry.id)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setTabContent(data.content); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitView, tabEntry?.id]);

  // Load chord pane content when split is enabled and current entry is not the chord entry
  useEffect(() => {
    if (!splitView || !chordEntry) { setChordContent(null); return; }
    // If the currently loaded content is already for the chord entry, reuse it
    if (currentEntry?.id === chordEntry.id && content !== null) {
      setChordContent(content);
      return;
    }
    fetch(`/api/library/${encodeURIComponent(chordEntry.id)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setChordContent(data.content); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitView, chordEntry?.id, content]);

  async function toggleAutoScroll() {
    if (!prefs) return;
    const next = { ...prefs, autoScroll: !prefs.autoScroll };
    setPrefs(next);
    await fetch("/api/prefs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
  }

  async function setAutoScrollSpeed(speed: number) {
    if (!prefs) return;
    const next = { ...prefs, autoScrollSpeed: speed };
    setPrefs(next);
    await fetch("/api/prefs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
  }

  async function toggleSplitView() {
    if (!prefs || !songKey) return;
    const next = !splitView;
    setSplitView(next);
    const nextPrefs = { ...prefs, splitView: { ...(prefs.splitView ?? {}), [songKey]: next } };
    setPrefs(nextPrefs);
    await fetch("/api/prefs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nextPrefs) });
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
    const newPrefs = {
      ...prefs,
      trackOverrides: { ...(prefs?.trackOverrides ?? {}), [trackId]: matchId }
    };
    await fetch("/api/prefs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newPrefs) });
    setPrefs(newPrefs as Prefs);
    fetch(`/api/library/${encodeURIComponent(matchId)}/spotify-track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackId })
    }).catch(() => {});
    setMatchResp({ ...matchResp, confidence: "exact", score: undefined });
  }

  async function selectVersion(entry: LibraryEntry) {
    setSelectedVersionId(entry.id);
    if (!prefs || !matchResp?.match) return;
    const newPrefs = {
      ...prefs,
      preferredVersion: { ...(prefs.preferredVersion ?? {}), [matchResp.match.songKey]: entry.id }
    };
    await fetch("/api/prefs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newPrefs) });
    setPrefs(newPrefs as Prefs);
  }

  async function removeMatch() {
    if (!trackId) return;

    // 1. Strip spotify_track_id from the library file if this match is bound to this track
    if (matchResp?.match?.spotifyTrackId) {
      await fetch(`/api/library/${encodeURIComponent(matchResp.match.id)}/spotify-track`, {
        method: "DELETE",
      }).catch(() => {});
    }

    // 2. Remove trackOverrides entry if set
    if (prefs?.trackOverrides?.[trackId]) {
      const newPrefs: Prefs = {
        ...prefs,
        trackOverrides: Object.fromEntries(
          Object.entries(prefs.trackOverrides).filter(([k]) => k !== trackId)
        ),
      };
      await fetch("/api/prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPrefs),
      });
      setPrefs(newPrefs);
    }

    // 3. Dismiss client-side
    setDismissedTrackId(trackId);
  }

  async function pickLibraryEntry(entry: LibraryEntry) {
    if (!trackId) return;
    setShowLibraryPicker(false);

    // Save override in prefs
    const newPrefs: Prefs = {
      ...prefs!,
      trackOverrides: { ...(prefs?.trackOverrides ?? {}), [trackId]: entry.id },
    };
    await fetch("/api/prefs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPrefs),
    });
    setPrefs(newPrefs);

    // Bake directive into the file
    await fetch(`/api/library/${encodeURIComponent(entry.id)}/spotify-track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackId }),
    }).catch(() => {});

    // Clear dismissed state and refetch match
    setDismissedTrackId(null);
    if (effectiveTrack) {
      const url = new URL("/api/library/match", window.location.origin);
      url.searchParams.set("track_id", trackId);
      url.searchParams.set("title", effectiveTrack.title);
      url.searchParams.set("artist", effectiveTrack.artists.join(", "));
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as MatchResponse;
        setMatchResp(data);
        if (data.match) {
          const r = await fetch(`/api/library/${encodeURIComponent(data.match.id)}`);
          if (r.ok) {
            const { content: c } = await r.json();
            setContent(c);
          }
        }
      }
    }
  }

  async function duplicateAsVersion() {
    if (!currentEntry) return;
    const versionName = window.prompt("Version name for the duplicate:", "Alternate");
    if (!versionName?.trim()) return;
    setDuplicatingVersion(true);
    try {
      const res = await fetch(`/api/library/${encodeURIComponent(currentEntry.id)}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionName: versionName.trim() })
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      alert(`Failed: ${(err as Error).message}`);
    } finally {
      setDuplicatingVersion(false);
    }
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
  const versions = matchResp?.allMatches;

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
        {/* Primary: auto-scroll (always inline) */}
        <label className="flex items-center gap-2" style={{ color: "var(--ink-muted)" }}>
          <input type="checkbox" checked={prefs?.autoScroll ?? false} onChange={toggleAutoScroll} />
          Auto-scroll
        </label>
        {prefs?.autoScroll && (
          <div className="flex items-center gap-1">
            {([0.5, 1, 1.5, 2] as const).map(speed => {
              const active = (prefs.autoScrollSpeed ?? 1) === speed;
              return (
                <button
                  key={speed}
                  onClick={() => setAutoScrollSpeed(speed)}
                  className="px-2 py-0.5 rounded text-xs transition-colors"
                  style={active
                    ? { backgroundColor: "var(--accent)", color: "var(--bg)" }
                    : { backgroundColor: "var(--bg-alt)", color: "var(--ink-muted)", border: "1px solid var(--border)" }
                  }
                  title={`${speed}× speed`}
                >
                  {speed}×
                </button>
              );
            })}
          </div>
        )}
        {/* Primary: transpose (always inline when visible) */}
        {effectiveMatch && (effectiveMatch.format === "chordpro" || (splitView && chordEntry)) && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTranspose(transposeOffset - 1)}
              className="h-10 min-w-10 md:h-7 md:min-w-7 px-2 rounded flex items-center justify-center"
              style={btnStyle}
              aria-label="Transpose down"
            >−</button>
            <span className="w-8 text-center tabular-nums" style={{ color: "var(--ink-muted)" }}>
              {transposeOffset > 0 ? `+${transposeOffset}` : transposeOffset === 0 ? "±0" : `${transposeOffset}`}
            </span>
            <button
              onClick={() => setTranspose(transposeOffset + 1)}
              className="h-10 min-w-10 md:h-7 md:min-w-7 px-2 rounded flex items-center justify-center"
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
        {/* Fuzzy confidence indicator (always inline, informational) */}
        {effectiveMatch && matchResp?.confidence === "fuzzy" && (
          <span style={{ color: "var(--ink-faint)" }}>
            (fuzzy {Math.round((matchResp.score ?? 0) * 100)}%)
          </span>
        )}
        {/* Secondary actions: inline on desktop, overflow menu on mobile */}
        {effectiveMatch && (
          <>
            {/* Desktop: inline secondary actions */}
            <div className="hidden md:flex items-center gap-3">
              {canSplit && (
                <label className="flex items-center gap-2 cursor-pointer" style={{ color: splitView ? "var(--accent)" : "var(--ink-muted)" }}>
                  <input type="checkbox" checked={splitView} onChange={toggleSplitView} />
                  Split view
                </label>
              )}
              {matchResp?.confidence && (
                <>
                  <button
                    onClick={removeMatch}
                    className="px-2 py-1 rounded text-xs"
                    style={btnStyle}
                    title="Remove this match and let me add/pick another"
                  >
                    not this song
                  </button>
                  {matchResp?.confidence === "fuzzy" && (
                    <button
                      onClick={lockFuzzyMatch}
                      className="px-2 py-1 rounded text-xs"
                      style={{ ...btnStyle, color: "var(--accent)" }}
                      title="Confirm this is the correct match"
                    >
                      Use this
                    </button>
                  )}
                </>
              )}
              <button onClick={() => setEditing(true)} className="px-2 py-1 rounded" style={btnStyle}>
                Edit
              </button>
              <button
                onClick={duplicateAsVersion}
                disabled={duplicatingVersion}
                className="px-2 py-1 rounded text-xs disabled:opacity-40"
                style={btnStyle}
                title="Duplicate as a new version"
              >
                {duplicatingVersion ? "Duplicating…" : "Duplicate version"}
              </button>
            </div>
            {/* Mobile: overflow menu */}
            <div className="flex md:hidden">
              <OverflowMenu items={[
                ...(canSplit ? [{ label: splitView ? "Disable split view" : "Enable split view", onClick: toggleSplitView }] : []),
                { label: "Edit", onClick: () => setEditing(true) },
                { label: duplicatingVersion ? "Duplicating…" : "Duplicate version", onClick: duplicateAsVersion, disabled: duplicatingVersion },
                ...(matchResp?.confidence ? [{ label: "Not this song", onClick: removeMatch }] : []),
                ...(matchResp?.confidence === "fuzzy" ? [{ label: "Use this match", onClick: lockFuzzyMatch }] : []),
                { label: "Pick from library", onClick: () => setShowLibraryPicker(true) },
              ]} />
            </div>
          </>
        )}
        {/* Playback controls */}
        {effectiveTrack && connected && (
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => playbackAction("previous")}
              className="h-10 min-w-10 md:h-7 md:min-w-7 px-2 rounded flex items-center justify-center"
              style={btnStyle}
              title="Previous (j / ←)"
              aria-label="Previous track"
            >
              ⏮
            </button>
            <button
              onClick={() => playbackAction("toggle")}
              className="h-10 min-w-10 md:h-7 md:min-w-7 px-2 rounded flex items-center justify-center"
              style={btnStyle}
              title="Play / Pause (space / k)"
              aria-label="Play or pause"
            >
              ⏯
            </button>
            <button
              onClick={() => playbackAction("next")}
              className="h-10 min-w-10 md:h-7 md:min-w-7 px-2 rounded flex items-center justify-center"
              style={btnStyle}
              title="Next (l / →)"
              aria-label="Next track"
            >
              ⏭
            </button>
          </div>
        )}
        <button
          onClick={() => setShowShortcuts(true)}
          className={effectiveTrack && connected ? "px-2 py-1 rounded text-xs" : "ml-auto px-2 py-1 rounded text-xs"}
          style={{ color: "var(--ink-faint)" }}
          title="Keyboard shortcuts"
        >
          ?
        </button>
      </div>
      {versions && versions.length > 1 && effectiveMatch && !splitView && (
        <div className="px-3 py-1.5 flex items-center gap-2 text-xs flex-wrap" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
          <span style={{ color: "var(--ink-faint)" }}>Version:</span>
          {versions.map(v => {
            const isSelected = (selectedVersionId ?? matchResp?.match?.id) === v.id;
            return (
              <button
                key={v.id}
                onClick={() => selectVersion(v)}
                className="px-2 py-0.5 rounded transition-colors"
                style={isSelected
                  ? { backgroundColor: "var(--accent)", color: "var(--bg)" }
                  : { backgroundColor: "var(--bg-alt)", color: "var(--ink-muted)", border: "1px solid var(--border)" }
                }
              >
                {v.versionName ?? "Original"}
              </button>
            );
          })}
        </div>
      )}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        {editing && effectiveMatch ? (
          <Editor id={effectiveMatch.id} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />
        ) : effectiveMatch && splitView && canSplit && chordEntry && tabEntry ? (
          <SplitView
            chordEntry={chordEntry}
            chordContent={chordContent}
            tabEntry={tabEntry}
            tabContent={tabContent}
            transposeOffset={transposeOffset}
            showChordDiagrams={prefs?.showChordDiagrams ?? true}
          />
        ) : effectiveMatch && content !== null ? (
          renderEntry(effectiveMatch, content, transposeOffset, prefs?.showChordDiagrams ?? true)
        ) : effectiveTrack ? (
          <div>
            <QuickAddForm track={effectiveTrack} onCreated={() => { setDismissedTrackId(null); setMatchRefetch(n => n + 1); }} />
            <div className="px-4 pb-4">
              <button
                onClick={() => setShowLibraryPicker(true)}
                className="px-3 py-1.5 rounded text-sm"
                style={btnStyle}
              >
                Or pick an existing sheet from the library
              </button>
            </div>
          </div>
        ) : (
          <div className="p-8 flex flex-col items-center gap-4 text-center" style={{ color: "var(--ink-muted)" }}>
            <div className="text-3xl" style={{ animation: "skeleton-pulse 2s ease-in-out infinite" }}>♪</div>
            <p className="text-sm max-w-xs">Press play on Spotify — chords will appear here automatically.</p>
          </div>
        )}
      </div>
      {showLibraryPicker && (
        <LibraryPicker
          onPick={pickLibraryEntry}
          onClose={() => setShowLibraryPicker(false)}
        />
      )}
      {np.data && prefs && (
        <AutoScroller
          enabled={prefs.autoScroll && !editing}
          progressMs={np.data.progressMs}
          durationMs={np.data.durationMs}
          speedMultiplier={prefs.autoScrollSpeed ?? 1}
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

type SplitViewProps = {
  chordEntry: LibraryEntry;
  chordContent: string | null;
  tabEntry: LibraryEntry;
  tabContent: string | null;
  transposeOffset: number;
  showChordDiagrams: boolean;
};

function SplitView({ chordEntry, chordContent, tabEntry, tabContent, transposeOffset, showChordDiagrams }: SplitViewProps) {
  const loadingStyle = { color: "var(--ink-faint)", padding: "1rem" };

  const chordPane = chordContent !== null
    ? <ChordProView source={chordContent} transpose={transposeOffset} showChordDiagrams={showChordDiagrams} />
    : <div style={loadingStyle}>Loading chords…</div>;

  const tabPane = tabEntry.format === "guitar-pro"
    ? <TabView kind="guitar-pro" src={`/api/library/raw/${encodeURIComponent(tabEntry.id)}`} />
    : tabContent !== null
      ? <TabView kind="ascii" text={tabContent} />
      : <div style={loadingStyle}>Loading tab…</div>;

  return (
    <div className="flex flex-col md:grid md:grid-cols-2 md:gap-0">
      <div
        className="p-4 md:border-r"
        style={{ borderColor: "var(--border)" }}
      >
        <div
          className="text-xs uppercase tracking-wide mb-3 pb-1"
          style={{ color: "var(--ink-faint)", borderBottom: "1px solid var(--border)" }}
        >
          Chords &middot; {chordEntry.versionName ?? "Chord sheet"}
        </div>
        {chordPane}
      </div>
      <div className="p-4 border-t md:border-t-0" style={{ borderColor: "var(--border)" }}>
        <div
          className="text-xs uppercase tracking-wide mb-3 pb-1"
          style={{ color: "var(--ink-faint)", borderBottom: "1px solid var(--border)" }}
        >
          Tab &middot; {tabEntry.versionName ?? "Tab"}
        </div>
        {tabPane}
      </div>
    </div>
  );
}
