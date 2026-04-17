"use client";

import { useEffect, useState, use, useCallback } from "react";
import { ChordProView } from "@/components/ChordProView";
import { TabView } from "@/components/TabView";
import { Editor } from "@/components/Editor";
import { useTranspose } from "@/hooks/useTranspose";
import type { LibraryEntry } from "@/lib/library/index";
import type { Prefs } from "@/lib/prefs/store";

type EntryResponse = { entry: LibraryEntry; content: string };

export default function LibraryEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const decoded = decodeURIComponent(id);

  const [data, setData] = useState<EntryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const { semitones, up, down, reset } = useTranspose();

  const loadEntry = useCallback(() => {
    setLoading(true);
    fetch(`/api/library/${encodeURIComponent(decoded)}`)
      .then(r => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<EntryResponse>;
      })
      .then(d => { setData(d); setError(null); })
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [decoded]);

  useEffect(() => { loadEntry(); }, [loadEntry]);
  useEffect(() => { fetch("/api/prefs").then(r => r.json()).then(setPrefs).catch(() => {}); }, []);

  if (loading) return (
    <div className="p-8 text-neutral-400">Loading…</div>
  );
  if (error || !data) return (
    <div className="p-8">
      <div className="text-red-400">Failed to load: {error ?? "not found"}</div>
    </div>
  );

  const { entry, content } = data;
  const isChordPro = entry.format === "chordpro";

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 flex items-center gap-3 border-b border-neutral-800 text-sm">
        <span className="flex-1 font-medium truncate">{entry.title}</span>
        <span className="text-neutral-500 shrink-0">{entry.artist}</span>
        {isChordPro && !editing && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={down} className="w-7 h-7 rounded bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center">−</button>
            <button
              onClick={reset}
              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-xs w-12 text-center"
              title="Reset transpose"
            >
              {semitones === 0 ? "0" : (semitones > 0 ? `+${semitones}` : `${semitones}`)}
            </button>
            <button onClick={up} className="w-7 h-7 rounded bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center">+</button>
          </div>
        )}
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 shrink-0"
          >
            Edit
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {editing ? (
          <Editor
            id={decoded}
            onClose={() => setEditing(false)}
            onSaved={() => { setEditing(false); loadEntry(); }}
          />
        ) : (
          renderEntry(entry, content, semitones, prefs?.showChordDiagrams ?? true)
        )}
      </div>
    </div>
  );
}

function renderEntry(entry: LibraryEntry, content: string, semitones: number, showChordDiagrams = true) {
  if (entry.format === "chordpro") return <ChordProView source={content} transpose={semitones} showChordDiagrams={showChordDiagrams} />;
  if (entry.format === "ascii-tab") return <TabView kind="ascii" text={content} />;
  return <TabView kind="guitar-pro" src={`/api/library/raw/${encodeURIComponent(entry.id)}`} />;
}
