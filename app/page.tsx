"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useNowPlaying } from "@/hooks/useNowPlaying";
import { NowPlayingHeader } from "@/components/NowPlayingHeader";
import { ConnectSpotify } from "@/components/ConnectSpotify";
import { ChordProView } from "@/components/ChordProView";
import { TabView } from "@/components/TabView";
import { AutoScroller } from "@/components/AutoScroller";
import { QuickAddForm } from "@/components/QuickAddForm";
import { Editor } from "@/components/Editor";
import type { LibraryEntry } from "@/lib/library/index";
import type { Prefs } from "@/lib/prefs/store";

type MatchResponse = { match: LibraryEntry | null; confidence: "exact" | "fuzzy" | null };

export default function HomePage() {
  const np = useNowPlaying();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [matchResp, setMatchResp] = useState<MatchResponse | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [editing, setEditing] = useState(false);
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

  if (connected === false) return <ConnectSpotify />;
  if (connected === null) return <div className="p-8 text-neutral-400">Loading…</div>;

  return (
    <div className="flex flex-col h-screen">
      <NowPlayingHeader data={np.data} />
      <div className="p-2 flex items-center gap-3 border-b border-neutral-800 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={prefs?.autoScroll ?? false} onChange={toggleAutoScroll} />
          Auto-scroll
        </label>
        {matchResp?.match && matchResp.match.format === "chordpro" && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTranspose(transposeOffset - 1)}
              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700"
              aria-label="Transpose down"
            >−</button>
            <span className="w-8 text-center tabular-nums">
              {transposeOffset > 0 ? `+${transposeOffset}` : transposeOffset === 0 ? "±0" : `${transposeOffset}`}
            </span>
            <button
              onClick={() => setTranspose(transposeOffset + 1)}
              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700"
              aria-label="Transpose up"
            >+</button>
            {transposeOffset !== 0 && (
              <button
                onClick={() => setTranspose(0)}
                className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400"
              >Reset</button>
            )}
          </div>
        )}
        {matchResp?.match && (
          <>
            <span className="text-neutral-500">
              {matchResp.confidence === "fuzzy" && "(fuzzy match)"}
            </span>
            <button onClick={() => setEditing(true)} className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700">
              Edit
            </button>
          </>
        )}
        <Link href="/library" className="text-neutral-500 hover:text-neutral-300 ml-auto">Library</Link>
        <form action="/api/auth/logout" method="post">
          <button className="text-neutral-500 hover:text-neutral-300" type="submit">Logout</button>
        </form>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto">
        {editing && matchResp?.match ? (
          <Editor id={matchResp.match.id} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />
        ) : matchResp?.match && content !== null ? (
          renderEntry(matchResp.match, content, transposeOffset)
        ) : np.data ? (
          <QuickAddForm track={np.data} onCreated={() => { /* next poll refetches */ }} />
        ) : (
          <div className="p-4 text-neutral-400">Waiting for Spotify…</div>
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
    </div>
  );
}

function renderEntry(entry: LibraryEntry, content: string, transpose = 0) {
  if (entry.format === "chordpro") return <ChordProView source={content} transpose={transpose} />;
  if (entry.format === "ascii-tab") return <TabView kind="ascii" text={content} />;
  return <TabView kind="guitar-pro" src={`/api/library/raw/${encodeURIComponent(entry.id)}`} />;
}
