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

type MatchResponse = { match: LibraryEntry | null; confidence: "exact" | "fuzzy" | null };

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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetch("/api/prefs").then(r => r.json()).then(setPrefs); }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/status");
      const body = await res.json().catch(() => ({ authenticated: false }));
      setConnected(!!body.authenticated);
    })();
  }, []);

  const trackId = np.data?.trackId;
  useEffect(() => {
    if (!trackId || !np.data) { setMatchResp(null); setContent(null); return; }
    (async () => {
      const url = new URL("/api/library/match", window.location.origin);
      url.searchParams.set("track_id", trackId);
      url.searchParams.set("title", np.data!.title);
      url.searchParams.set("artist", np.data!.artists.join(", "));
      const res = await fetch(url);
      if (!res.ok) return;
      const data = (await res.json()) as MatchResponse;
      setMatchResp(data);
      if (data.match) {
        const r = await fetch(`/api/library/${encodeURIComponent(data.match.id)}`);
        if (r.ok) {
          const { content: c } = await r.json();
          setContent(c);
        }
      } else {
        setContent(null);
      }
    })();
  }, [trackId, np.data]);

  const currentId = matchResp?.match?.id;
  const transposeOffset: number = (currentId ? (prefs?.songTranspose?.[currentId] ?? 0) : 0);

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
    "e": () => { if (matchResp?.match) setEditing(e => !e); },
    "?": () => setShowShortcuts(s => !s),
  });

  if (connected === false) return <ConnectSpotify />;
  if (connected === null) return <div className="p-8" style={{ color: "var(--ink-muted)" }}>Loading…</div>;

  return (
    <div className="flex flex-col h-full">
      <NowPlayingHeader data={np.data} />
      {playbackError && (
        <div className="px-4 py-2 text-sm flex items-center justify-between" style={{ backgroundColor: "var(--bg-surface)", color: "var(--danger)", borderBottom: "1px solid var(--border)" }}>
          <span>{playbackError}</span>
          <button onClick={() => setPlaybackError(null)} style={{ color: "var(--ink-faint)" }}>✕</button>
        </div>
      )}
      <div className="p-2 flex items-center gap-3 text-sm" style={{ borderBottom: "1px solid var(--border)" }}>
        <label className="flex items-center gap-2" style={{ color: "var(--ink-muted)" }}>
          <input type="checkbox" checked={prefs?.autoScroll ?? false} onChange={toggleAutoScroll} />
          Auto-scroll
        </label>
        {matchResp?.match && matchResp.match.format === "chordpro" && (
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
        {matchResp?.match && (
          <>
            <span style={{ color: "var(--ink-faint)" }}>
              {matchResp.confidence === "fuzzy" && "(fuzzy match)"}
            </span>
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
        {editing && matchResp?.match ? (
          <Editor id={matchResp.match.id} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />
        ) : matchResp?.match && content !== null ? (
          renderEntry(matchResp.match, content, transposeOffset)
        ) : np.data ? (
          <QuickAddForm track={np.data} onCreated={() => { /* next poll refetches */ }} />
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

function renderEntry(entry: LibraryEntry, content: string, transpose = 0) {
  if (entry.format === "chordpro") return <ChordProView source={content} transpose={transpose} />;
  if (entry.format === "ascii-tab") return <TabView kind="ascii" text={content} />;
  return <TabView kind="guitar-pro" src={`/api/library/raw/${encodeURIComponent(entry.id)}`} />;
}
