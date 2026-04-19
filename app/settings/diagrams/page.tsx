"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ChordDiagram } from "@/components/ChordDiagram";
import type { ChordEntry } from "@/lib/chord-diagrams/chord-db";
import type { UserChordDb } from "@/lib/chord-diagrams/user-chord-db";

// String/fret grid constants
const STRINGS = 6; // 1 = high E, 6 = low E
const FRETS = 5; // visible fret rows

type StringState = "open" | "muted" | number; // number = fret pressed

type GridState = {
  strings: StringState[]; // index 0 = string 1 (high E)
  baseFret: number;
};

function defaultGrid(): GridState {
  return {
    strings: Array(STRINGS).fill("open") as StringState[],
    baseFret: 1,
  };
}

/** Convert a ChordEntry to a GridState for editing */
function chordEntryToGrid(entry: ChordEntry): GridState {
  const strings: StringState[] = Array(STRINGS).fill("open") as StringState[];
  const baseFret = entry.position ?? 1;

  for (const finger of entry.fingers) {
    const [strNum, fret] = finger;
    const idx = strNum - 1; // string 1 -> index 0
    if (idx < 0 || idx >= STRINGS) continue;
    if (fret === "x") {
      strings[idx] = "muted";
    } else if (fret === 0) {
      strings[idx] = "open";
    } else {
      strings[idx] = fret as number;
    }
  }

  return { strings, baseFret };
}

/** Convert a GridState to a ChordEntry */
function gridToChordEntry(grid: GridState): ChordEntry {
  const fingers: ChordEntry["fingers"] = [];
  for (let i = 0; i < STRINGS; i++) {
    const strNum = i + 1;
    const state = grid.strings[i];
    if (state === "muted") {
      fingers.push([strNum, "x"]);
    } else if (state === "open") {
      fingers.push([strNum, 0]);
    } else {
      fingers.push([strNum, state as number]);
    }
  }
  const entry: ChordEntry = { fingers, barres: [] };
  if (grid.baseFret > 1) entry.position = grid.baseFret;
  return entry;
}

/** Cycle string top indicator: open -> muted -> open */
function cycleStringState(current: StringState): StringState {
  if (current === "open") return "muted";
  return "open";
}

export default function DiagramsPage() {
  const [allChords, setAllChords] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<UserChordDb>({});
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [grid, setGrid] = useState<GridState>(defaultGrid());
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  // Load chord list and current overrides
  useEffect(() => {
    fetch("/api/library/unique-chords")
      .then(r => r.json())
      .then((body: { chords?: string[] }) => setAllChords(body.chords ?? []))
      .catch(() => {});
    fetch("/api/chord-diagrams")
      .then(r => r.json())
      .then((body: { overrides?: UserChordDb }) => setOverrides(body.overrides ?? {}))
      .catch(() => {});
  }, []);

  const filteredChords = allChords.filter(c =>
    c.toLowerCase().includes(search.toLowerCase())
  );

  function selectChord(name: string) {
    setSelected(name);
    const override = overrides[name];
    if (override) {
      setGrid(chordEntryToGrid(override));
    } else {
      setGrid(defaultGrid());
    }
    setStatus(null);
  }

  function toggleFret(stringIdx: number, fretNum: number) {
    // fretNum is 1-based relative to baseFret display
    // store as absolute fret = baseFret + fretNum - 1
    const absoluteFret = grid.baseFret + fretNum - 1;
    setGrid(prev => {
      const strings = [...prev.strings] as StringState[];
      const current = strings[stringIdx];
      // Toggle: if already this fret, set open; otherwise set fret
      if (current === absoluteFret) {
        strings[stringIdx] = "open";
      } else {
        strings[stringIdx] = absoluteFret;
      }
      return { ...prev, strings };
    });
  }

  function toggleStringTop(stringIdx: number) {
    setGrid(prev => {
      const strings = [...prev.strings] as StringState[];
      strings[stringIdx] = cycleStringState(strings[stringIdx]);
      return { ...prev, strings };
    });
  }

  async function saveOverride() {
    if (!selected) return;
    setSaving(true);
    setStatus(null);
    try {
      const positions = gridToChordEntry(grid);
      const res = await fetch("/api/chord-diagrams", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selected, positions }),
      });
      if (!res.ok) throw new Error("Save failed");
      setOverrides(prev => ({ ...prev, [selected]: positions }));
      window.dispatchEvent(new Event("chord-diagrams-changed"));
      setStatus("Saved.");
    } catch {
      setStatus("Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function resetOverride() {
    if (!selected) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/chord-diagrams?name=${encodeURIComponent(selected)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Reset failed");
      setOverrides(prev => {
        const next = { ...prev };
        delete next[selected];
        return next;
      });
      setGrid(defaultGrid());
      window.dispatchEvent(new Event("chord-diagrams-changed"));
      setStatus("Reset to default.");
    } catch {
      setStatus("Reset failed.");
    } finally {
      setSaving(false);
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(overrides, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "chord-overrides.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const imported = JSON.parse(reader.result as string) as UserChordDb;
        const keys = Object.keys(imported);
        let saved = 0;
        for (const name of keys) {
          const positions = imported[name];
          if (!positions || !Array.isArray(positions.fingers)) continue;
          const res = await fetch("/api/chord-diagrams", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, positions }),
          });
          if (res.ok) saved++;
        }
        // Reload overrides
        const body = await fetch("/api/chord-diagrams").then(r => r.json()) as { overrides?: UserChordDb };
        setOverrides(body.overrides ?? {});
        window.dispatchEvent(new Event("chord-diagrams-changed"));
        setStatus(`Imported ${saved} overrides.`);
      } catch {
        setStatus("Import failed — invalid JSON.");
      }
      // Reset file input
      if (importRef.current) importRef.current.value = "";
    };
    reader.readAsText(file);
  }, []);

  const hasOverride = selected ? !!overrides[selected] : false;

  return (
    <div className="p-6 flex flex-col gap-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg font-medium" style={{ color: "var(--ink)" }}>Custom Chord Diagrams</h1>
        <div className="flex gap-2">
          <button
            onClick={exportJson}
            className="px-3 py-1.5 rounded text-sm transition-colors"
            style={{ backgroundColor: "var(--bg-alt)", color: "var(--ink-muted)", border: "1px solid var(--border)" }}
          >
            Export JSON
          </button>
          <label
            className="px-3 py-1.5 rounded text-sm cursor-pointer transition-colors"
            style={{ backgroundColor: "var(--bg-alt)", color: "var(--ink-muted)", border: "1px solid var(--border)" }}
          >
            Import JSON
            <input
              ref={importRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={handleImport}
            />
          </label>
        </div>
      </div>

      <div className="flex gap-4" style={{ minHeight: 500 }}>
        {/* Left column: chord list */}
        <div className="flex flex-col gap-2" style={{ width: 200, flexShrink: 0 }}>
          <input
            type="search"
            placeholder="Filter chords…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded px-3 py-1.5 text-sm"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border)",
              color: "var(--ink)",
              outline: "none",
            }}
          />
          <div
            className="rounded overflow-y-auto flex flex-col"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border)",
              flex: 1,
              maxHeight: 460,
            }}
          >
            {filteredChords.length === 0 && (
              <div className="p-3 text-sm" style={{ color: "var(--ink-faint)" }}>
                {allChords.length === 0 ? "Loading…" : "No chords match"}
              </div>
            )}
            {filteredChords.map(chord => (
              <button
                key={chord}
                onClick={() => selectChord(chord)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors"
                style={{
                  backgroundColor: selected === chord ? "var(--accent)" : "transparent",
                  color: selected === chord ? "var(--bg)" : "var(--ink)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span className="flex-1 font-mono">{chord}</span>
                {overrides[chord] && (
                  <span
                    className="text-xs rounded px-1"
                    style={{
                      backgroundColor: selected === chord ? "rgba(0,0,0,0.2)" : "var(--accent)",
                      color: selected === chord ? "var(--bg)" : "var(--bg)",
                    }}
                  >
                    custom
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Right column: editor */}
        <div className="flex-1 flex flex-col gap-4">
          {!selected ? (
            <div
              className="rounded p-8 flex items-center justify-center text-sm"
              style={{
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border)",
                color: "var(--ink-faint)",
                flex: 1,
              }}
            >
              Select a chord to edit its diagram
            </div>
          ) : (
            <div
              className="rounded p-4 flex flex-col gap-4"
              style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="font-mono text-lg font-semibold" style={{ color: "var(--ink)" }}>{selected}</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="flex items-center gap-2 text-sm" style={{ color: "var(--ink-muted)" }}>
                    Base fret:
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={grid.baseFret}
                      onChange={e => setGrid(prev => ({ ...prev, baseFret: Math.max(1, parseInt(e.target.value) || 1) }))}
                      className="w-14 rounded px-2 py-1 text-sm font-mono"
                      style={{
                        backgroundColor: "var(--bg-alt)",
                        border: "1px solid var(--border)",
                        color: "var(--ink)",
                      }}
                    />
                  </label>
                  <button
                    onClick={saveOverride}
                    disabled={saving}
                    className="px-3 py-1.5 rounded text-sm font-medium transition-colors"
                    style={{ backgroundColor: "var(--accent)", color: "var(--bg)" }}
                  >
                    Save override
                  </button>
                  {hasOverride && (
                    <button
                      onClick={resetOverride}
                      disabled={saving}
                      className="px-3 py-1.5 rounded text-sm transition-colors"
                      style={{
                        backgroundColor: "var(--bg-alt)",
                        color: "var(--ink-muted)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      Reset to default
                    </button>
                  )}
                </div>
              </div>

              {status && (
                <p className="text-sm" style={{ color: "var(--ink-muted)" }}>{status}</p>
              )}

              <div className="flex gap-6 flex-wrap">
                {/* Interactive fret grid */}
                <div className="flex flex-col gap-1">
                  <p className="text-xs mb-1" style={{ color: "var(--ink-faint)" }}>
                    Click top row to toggle muted/open. Click frets to place fingers.
                  </p>
                  <FretGrid
                    grid={grid}
                    onToggleFret={toggleFret}
                    onToggleStringTop={toggleStringTop}
                  />
                </div>

                {/* Live preview */}
                <div className="flex flex-col gap-2">
                  <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Preview (saved)</p>
                  <ChordDiagram name={selected} size="lg" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FretGrid component
// ---------------------------------------------------------------------------

function FretGrid({
  grid,
  onToggleFret,
  onToggleStringTop,
}: {
  grid: GridState;
  onToggleFret: (stringIdx: number, fretNum: number) => void;
  onToggleStringTop: (stringIdx: number) => void;
}) {
  const cellSize = 40;
  const headerH = 32;

  return (
    <div style={{ userSelect: "none" }}>
      {/* String header row: X / O indicators */}
      <div className="flex" style={{ marginBottom: 2 }}>
        {/* Fret label column spacer */}
        <div style={{ width: 28 }} />
        {Array.from({ length: STRINGS }, (_, si) => {
          const state = grid.strings[si];
          const label = state === "muted" ? "X" : "O";
          return (
            <button
              key={si}
              onClick={() => onToggleStringTop(si)}
              className="flex items-center justify-center rounded text-xs font-mono font-bold transition-colors"
              title={state === "muted" ? "Click to open" : "Click to mute"}
              style={{
                width: cellSize,
                height: headerH,
                backgroundColor: state === "muted" ? "var(--bg-alt)" : "transparent",
                color: state === "muted" ? "var(--ink-muted)" : "var(--ink-faint)",
                border: "1px solid var(--border)",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Fret rows */}
      {Array.from({ length: FRETS }, (_, fi) => {
        const fretNum = fi + 1; // 1-based relative fret
        const absoluteFret = grid.baseFret + fretNum - 1;
        return (
          <div key={fi} className="flex" style={{ marginBottom: 1 }}>
            {/* Fret number label */}
            <div
              className="flex items-center justify-end pr-2 text-xs font-mono"
              style={{ width: 28, color: "var(--ink-faint)" }}
            >
              {absoluteFret}
            </div>
            {Array.from({ length: STRINGS }, (_, si) => {
              const stringState = grid.strings[si];
              const isActive = stringState === absoluteFret;
              return (
                <button
                  key={si}
                  onClick={() => onToggleFret(si, fretNum)}
                  className="flex items-center justify-center transition-colors"
                  style={{
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: isActive ? "var(--accent)" : "var(--bg-alt)",
                    border: "1px solid var(--border)",
                    borderRadius: isActive ? "50%" : 4,
                    cursor: "pointer",
                  }}
                >
                  {isActive && (
                    <span
                      className="text-xs font-bold font-mono"
                      style={{ color: "var(--bg)" }}
                    >
                      {absoluteFret}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        );
      })}

      {/* String labels at bottom */}
      <div className="flex mt-2" style={{ paddingLeft: 28 }}>
        {["e", "B", "G", "D", "A", "E"].map((label, si) => (
          <div
            key={si}
            className="flex items-center justify-center text-xs font-mono"
            style={{ width: cellSize, color: "var(--ink-faint)" }}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
