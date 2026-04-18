"use client";

import { useEffect, useRef, useState } from "react";
import type { LibraryEntry } from "@/lib/library/index";

type Props = {
  onPick: (entry: LibraryEntry) => void;
  onClose: () => void;
};

type SlimEntry = Pick<LibraryEntry, "id" | "title" | "artist" | "format">;

export function LibraryPicker({ onPick, onClose }: Props) {
  const [entries, setEntries] = useState<SlimEntry[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/library/all")
      .then(r => r.ok ? r.json() : { entries: [] })
      .then((body: { entries: SlimEntry[] }) => {
        setEntries(body.entries ?? []);
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  // Focus filter input on open
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const q = filter.toLowerCase();
  const visible = q
    ? entries.filter(e =>
        e.title.toLowerCase().includes(q) || e.artist.toLowerCase().includes(q)
      )
    : entries;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="rounded-lg flex flex-col max-w-lg w-full mx-4 shadow-2xl"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border)",
          maxHeight: "80vh",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 pb-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
            Pick a sheet from your library
          </h2>
          <button
            onClick={onClose}
            className="text-sm"
            style={{ color: "var(--ink-faint)" }}
          >
            ✕
          </button>
        </div>

        <div className="px-4 pb-2">
          <input
            ref={inputRef}
            type="text"
            placeholder="Filter by title or artist…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-full px-3 py-1.5 rounded text-sm"
            style={{
              backgroundColor: "var(--bg-alt)",
              color: "var(--ink)",
              border: "1px solid var(--border)",
              outline: "none",
            }}
          />
        </div>

        <div className="overflow-y-auto flex-1 px-2 pb-2">
          {loading ? (
            <p className="text-sm p-4 text-center" style={{ color: "var(--ink-muted)" }}>Loading…</p>
          ) : visible.length === 0 ? (
            <p className="text-sm p-4 text-center" style={{ color: "var(--ink-muted)" }}>No entries found.</p>
          ) : (
            visible.map(entry => (
              <button
                key={entry.id}
                onClick={() => onPick(entry as LibraryEntry)}
                className="w-full text-left px-3 py-2 rounded flex flex-col transition-colors"
                style={{ color: "var(--ink)" }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-alt)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "";
                }}
              >
                <span className="text-sm font-medium">{entry.title}</span>
                <span className="text-xs" style={{ color: "var(--ink-muted)" }}>{entry.artist}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
