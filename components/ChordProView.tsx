"use client";

import { useEffect, useMemo, useRef } from "react";
import { ChordProParser, HtmlDivFormatter } from "chordsheetjs";
import type { Song } from "chordsheetjs";
import { ChordDiagram } from "@/components/ChordDiagram";
import { detectKey, capoSuggestion, normalizeChordRoot } from "@/lib/music/key-detection";
import { stripMetaPreamble } from "@/lib/chordpro/strip-meta";

const CHROMATIC_KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function transposeKey(key: string, semitones: number): string {
  if (semitones === 0) return key;
  const root = normalizeChordRoot(key);
  if (!root) return key;
  const idx = CHROMATIC_KEYS.indexOf(root);
  if (idx < 0) return key;
  return CHROMATIC_KEYS[((idx + semitones) % 12 + 12) % 12];
}

function isChordName(s: string): boolean {
  return /^[A-G][#b]?/.test(s);
}

function chordDedupKey(name: string): string {
  // D/C and D/B both map to the same D diagram — deduplicate on the base chord
  return name.replace(/\/[A-Ga-g][#b]?$/, "").trim();
}

function extractUniqueChords(song: Song): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const line of song.lines) {
    for (const item of line.items) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chords: string = (item as any).chords ?? "";
      if (!chords || !isChordName(chords)) continue;
      const key = chordDedupKey(chords);
      if (!seen.has(key)) {
        seen.add(key);
        ordered.push(chords);
      }
    }
  }
  return ordered;
}

function hasAsciiTabLines(source: string): boolean {
  // Guitar tab lines start with a string name (e B G D A E) followed by |
  return /^[eBGDAE]\s*[|┤]/m.test(source);
}

function extractAllChords(song: Song): string[] {
  const all: string[] = [];
  for (const line of song.lines) {
    for (const item of line.items) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chords: string = (item as any).chords ?? "";
      if (chords && isChordName(chords)) all.push(chords);
    }
  }
  return all;
}

export function ChordProView({
  source,
  transpose = 0,
  showChordDiagrams = true,
}: {
  source: string;
  transpose?: number;
  showChordDiagrams?: boolean;
}) {
  const containsTab = useMemo(() => hasAsciiTabLines(source), [source]);

  const { html, uniqueChords, keyLabel, capo } = useMemo(() => {
    try {
      const stripped = stripMetaPreamble(source);
      const song = new ChordProParser().parse(stripped);
      const transposed = transpose ? song.transpose(transpose) : song;

      const directiveMatch = source.match(/\{\s*key\s*:\s*([^}]+)\}/i);
      const directiveKey = directiveMatch
        ? transposeKey(directiveMatch[1].trim(), transpose)
        : null;

      const allChords = extractAllChords(transposed);
      const detectedKey = detectKey(allChords);
      const keyLabel = directiveKey ?? detectedKey;
      const capo = keyLabel && transpose > 0 ? capoSuggestion(keyLabel, transpose) : null;

      return {
        html: new HtmlDivFormatter().format(transposed),
        uniqueChords: showChordDiagrams ? extractUniqueChords(transposed) : [],
        keyLabel,
        capo,
      };
    } catch (err) {
      return {
        html: `<pre class="text-red-400">Parse error: ${(err as Error).message}</pre><pre>${escapeHtml(source)}</pre>`,
        uniqueChords: [],
        keyLabel: null,
        capo: null,
      };
    }
  }, [source, transpose, showChordDiagrams]);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  // Click a chord in the sheet → scroll its palette diagram into view and pulse it.
  // Queries [data-chord] from the root so both mobile and desktop palettes work.
  useEffect(() => {
    if (!sheetRef.current || !rootRef.current) return;
    const sheet = sheetRef.current;
    const root = rootRef.current;

    const chordEls = sheet.querySelectorAll<HTMLElement>(".chord");
    const listeners: Array<[HTMLElement, EventListener]> = [];

    chordEls.forEach(el => {
      const name = el.textContent?.trim();
      if (!name) return;
      el.style.cursor = "pointer";
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      const handler: EventListener = (ev) => {
        ev.preventDefault();
        // On mobile the palette is the horizontal strip; on desktop it's the rail.
        // querySelector finds whichever is visible first in DOM order.
        const target = root.querySelector<HTMLElement>(`[data-chord="${CSS.escape(name)}"]`);
        if (!target) return;
        target.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        target.classList.remove("chord-pulse");
        // Force reflow so the animation restarts when clicking the same chord twice.
        void target.offsetWidth;
        target.classList.add("chord-pulse");
      };
      el.addEventListener("click", handler);
      el.addEventListener("keydown", (e) => {
        const ke = e as KeyboardEvent;
        if (ke.key === "Enter" || ke.key === " ") handler(e);
      });
      listeners.push([el, handler]);
    });

    return () => {
      for (const [el, h] of listeners) {
        el.removeEventListener("click", h);
      }
    };
  }, [html]);

  return (
    <div ref={rootRef}>
      {keyLabel && (
        <div className="mb-2 text-xs uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
          {capo
            ? `Key · ${keyLabel} · capo ${capo.capoFret} → play in ${capo.shapeKey} shapes`
            : `Key · ${keyLabel}`}
        </div>
      )}
      <div className="md:flex md:flex-row md:gap-4">
        <div className="flex-1 min-w-0">
          {showChordDiagrams && uniqueChords.length > 0 && (
            /* Mobile: top-sticky horizontal scroll palette */
            <div
              className="md:hidden chord-palette sticky top-0 z-10 flex gap-3 overflow-x-auto py-2 mb-3"
              style={{
                borderBottom: "1px solid var(--border)",
                backgroundColor: "var(--bg)",
              }}
              aria-label="Chord diagrams"
            >
              {uniqueChords.map(c => (
                <div key={c} data-chord={c} className="shrink-0 transition-transform">
                  <ChordDiagram name={c} size="sm" />
                </div>
              ))}
            </div>
          )}
          <div
            ref={sheetRef}
            className="chordpro prose prose-invert max-w-none font-mono"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
        {showChordDiagrams && !containsTab && uniqueChords.length > 0 && (
          /* Desktop: right rail, vertical stack, sticky. Hidden for ASCII-tab content since
             long tab lines need the full width. */
          <aside className="hidden md:block md:w-[140px] md:flex-shrink-0">
            <div
              className="sticky top-0 flex flex-col gap-3 pl-3 py-2"
              style={{ borderLeft: "1px solid var(--border)" }}
              aria-label="Chord diagrams"
            >
              {uniqueChords.map(c => (
                <div key={c} data-chord={c}>
                  <ChordDiagram name={c} size="sm" />
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}
