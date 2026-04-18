"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
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

  const router = useRouter();
  const [data, setData] = useState<EntryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [splitView, setSplitView] = useState(false);
  const [siblings, setSiblings] = useState<LibraryEntry[]>([]);
  const [tabContent, setTabContent] = useState<string | null>(null);
  const [chordContentForSplit, setChordContentForSplit] = useState<string | null>(null);
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

  // Fetch all library entries to find siblings with the same songKey
  useEffect(() => {
    if (!data) return;
    fetch("/api/library/all")
      .then(r => r.json())
      .then((payload: { entries: LibraryEntry[] }) => {
        const sibs = (payload.entries ?? []).filter(
          e => e.songKey === data.entry.songKey && e.id !== data.entry.id
        );
        setSiblings(sibs);
      })
      .catch(() => {});
  }, [data]);

  // Restore split-view preference when entry loads
  useEffect(() => {
    if (!prefs || !data) return;
    setSplitView(prefs.splitView?.[data.entry.songKey] ?? false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.entry.songKey]);

  // Compute split view availability
  const allFormats = new Set([data?.entry.format, ...siblings.map(s => s.format)].filter(Boolean));
  const canSplit = allFormats.size > 1 && allFormats.has("chordpro") && (allFormats.has("ascii-tab") || allFormats.has("guitar-pro"));

  const chordEntry = canSplit
    ? (data?.entry.format === "chordpro" ? data.entry : siblings.find(s => s.format === "chordpro"))
    : null;
  const tabEntry = canSplit
    ? (data?.entry.format === "ascii-tab" || data?.entry.format === "guitar-pro"
        ? data.entry
        : siblings.find(s => s.format === "ascii-tab" || s.format === "guitar-pro"))
    : null;

  // Load split pane contents
  useEffect(() => {
    if (!splitView || !tabEntry || tabEntry.format === "guitar-pro") { setTabContent(null); return; }
    if (tabEntry.id === data?.entry.id && data.content) { setTabContent(data.content); return; }
    fetch(`/api/library/${encodeURIComponent(tabEntry.id)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setTabContent(d.content); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitView, tabEntry?.id]);

  useEffect(() => {
    if (!splitView || !chordEntry) { setChordContentForSplit(null); return; }
    if (chordEntry.id === data?.entry.id && data.content) { setChordContentForSplit(data.content); return; }
    fetch(`/api/library/${encodeURIComponent(chordEntry.id)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setChordContentForSplit(d.content); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitView, chordEntry?.id]);

  async function toggleSplitView() {
    if (!prefs || !data) return;
    const next = !splitView;
    setSplitView(next);
    const nextPrefs = { ...prefs, splitView: { ...(prefs.splitView ?? {}), [data.entry.songKey]: next } };
    setPrefs(nextPrefs);
    await fetch("/api/prefs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextPrefs),
    });
  }

  async function handleDuplicate() {
    if (!data) return;
    const versionName = window.prompt("Version name for the duplicate:", "Alternate");
    if (!versionName?.trim()) return;
    setDuplicating(true);
    try {
      const res = await fetch(`/api/library/${encodeURIComponent(decoded)}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionName: versionName.trim() })
      });
      if (!res.ok) throw new Error(await res.text());
      const { id: newId } = await res.json();
      router.push(`/library/${encodeURIComponent(newId)}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDuplicating(false);
    }
  }

  async function handleDelete() {
    if (!data) return;
    const confirmed = window.confirm(`Delete "${data.entry.title}"? This removes the file from the library.`);
    if (!confirmed) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/library/${encodeURIComponent(decoded)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      router.push("/library");
    } catch (err) {
      setError((err as Error).message);
      setDeleting(false);
    }
  }

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
  const showTranspose = !editing && (isChordPro || (splitView && canSplit));

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 flex items-center gap-3 border-b border-neutral-800 text-sm">
        <span className="flex-1 font-medium truncate">{entry.title}</span>
        <span className="text-neutral-500 shrink-0">{entry.artist}</span>
        {showTranspose && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={down} className="h-10 w-10 md:h-7 md:w-7 rounded bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center">−</button>
            <button
              onClick={reset}
              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-xs w-12 text-center"
              title="Reset transpose"
            >
              {semitones === 0 ? "0" : (semitones > 0 ? `+${semitones}` : `${semitones}`)}
            </button>
            <button onClick={up} className="h-10 w-10 md:h-7 md:w-7 rounded bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center">+</button>
          </div>
        )}
        {canSplit && !editing && (
          <label
            className="flex items-center gap-1.5 text-xs shrink-0 cursor-pointer"
            style={{ color: splitView ? "var(--accent)" : "var(--ink-muted)" }}
          >
            <input type="checkbox" checked={splitView} onChange={toggleSplitView} />
            Split view
          </label>
        )}
        {!editing && (
          <>
            <button
              onClick={() => setEditing(true)}
              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 shrink-0"
            >
              Edit
            </button>
            <button
              onClick={handleDuplicate}
              disabled={duplicating}
              className="px-2 py-1 rounded text-xs shrink-0 transition-colors disabled:opacity-50"
              style={{ backgroundColor: "var(--bg-surface)", color: "var(--ink-muted)", border: "1px solid var(--border)" }}
              title="Duplicate as a new version"
            >
              {duplicating ? "Duplicating…" : "Duplicate version"}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-2 py-1 rounded text-xs shrink-0 transition-colors disabled:opacity-50"
              style={{ backgroundColor: "var(--bg-surface)", color: "var(--danger)", border: "1px solid var(--border)" }}
              title="Delete this sheet"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {editing ? (
          <Editor
            id={decoded}
            onClose={() => setEditing(false)}
            onSaved={() => { setEditing(false); loadEntry(); }}
          />
        ) : splitView && canSplit && chordEntry && tabEntry ? (
          <LibrarySplitView
            chordEntry={chordEntry}
            chordContent={chordContentForSplit}
            tabEntry={tabEntry}
            tabContent={tabContent}
            semitones={semitones}
            showChordDiagrams={prefs?.showChordDiagrams ?? true}
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

type LibrarySplitViewProps = {
  chordEntry: LibraryEntry;
  chordContent: string | null;
  tabEntry: LibraryEntry;
  tabContent: string | null;
  semitones: number;
  showChordDiagrams: boolean;
};

function LibrarySplitView({ chordEntry, chordContent, tabEntry, tabContent, semitones, showChordDiagrams }: LibrarySplitViewProps) {
  const loadingStyle = { color: "var(--ink-faint)", padding: "1rem" };

  const chordPane = chordContent !== null
    ? <ChordProView source={chordContent} transpose={semitones} showChordDiagrams={showChordDiagrams} />
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
