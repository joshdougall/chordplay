"use client";

import { useMemo } from "react";
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
      // ChordSheetJS items have a `.chords` string on ChordLyricsPair objects
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

/** Extract all chord occurrences (including duplicates) for key detection. */
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

      // Prefer {key: X} directive if present in the source; transpose it to
      // the displayed key when a transposition is active.
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
          className="chord-palette flex gap-3 overflow-x-auto pb-3 mb-3"
          style={{ borderBottom: "1px solid var(--border)" }}
          aria-label="Chord diagrams"
        >
          {uniqueChords.map(c => (
            <ChordDiagram key={c} name={c} size="sm" />
          ))}
        </div>
      )}
      <div
        className="chordpro prose prose-invert max-w-none font-mono"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {/* TODO: hover popovers on inline .chord spans — follow-up task */}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}
