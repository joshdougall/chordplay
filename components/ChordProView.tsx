"use client";

import { useEffect, useMemo, useRef } from "react";
import { ChordProParser, HtmlDivFormatter } from "chordsheetjs";
import type { Song } from "chordsheetjs";
import { ChordDiagram } from "@/components/ChordDiagram";
import { detectKey, capoSuggestion, normalizeChordRoot } from "@/lib/music/key-detection";

const CHROMATIC_KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function transposeKey(key: string, semitones: number): string {
  if (semitones === 0) return key;
  const root = normalizeChordRoot(key);
  if (!root) return key;
  const idx = CHROMATIC_KEYS.indexOf(root);
  if (idx < 0) return key;
  return CHROMATIC_KEYS[((idx + semitones) % 12 + 12) % 12];
}

function extractUniqueChords(song: Song): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const line of song.lines) {
    for (const item of line.items) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chords: string = (item as any).chords ?? "";
      if (chords && !seen.has(chords)) {
        seen.add(chords);
        ordered.push(chords);
      }
    }
  }
  return ordered;
}

function extractAllChords(song: Song): string[] {
  const all: string[] = [];
  for (const line of song.lines) {
    for (const item of line.items) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chords: string = (item as any).chords ?? "";
      if (chords) all.push(chords);
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
  const { html, uniqueChords, keyLabel, capo } = useMemo(() => {
    try {
      const song = new ChordProParser().parse(source);
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

  const paletteRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  // Click a chord in the sheet → scroll its palette diagram into view and pulse it.
  useEffect(() => {
    if (!sheetRef.current || !paletteRef.current) return;
    const sheet = sheetRef.current;
    const palette = paletteRef.current;

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
        const target = palette.querySelector<HTMLElement>(`[data-chord="${CSS.escape(name)}"]`);
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
    <div>
      {keyLabel && (
        <div className="mb-2 text-xs uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
          {capo
            ? `Key · ${keyLabel} · capo ${capo.capoFret} → play in ${capo.shapeKey} shapes`
            : `Key · ${keyLabel}`}
        </div>
      )}
      {showChordDiagrams && uniqueChords.length > 0 && (
        <div
          ref={paletteRef}
          className="chord-palette sticky top-0 z-10 flex gap-3 overflow-x-auto py-2 mb-3"
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
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}
