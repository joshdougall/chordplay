"use client";

import { useMemo } from "react";
import { ChordProParser, HtmlDivFormatter } from "chordsheetjs";
import type { Song } from "chordsheetjs";
import { ChordDiagram } from "@/components/ChordDiagram";

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

export function ChordProView({
  source,
  transpose = 0,
  showChordDiagrams = true,
}: {
  source: string;
  transpose?: number;
  showChordDiagrams?: boolean;
}) {
  const { html, uniqueChords } = useMemo(() => {
    try {
      const song = new ChordProParser().parse(source);
      const transposed = transpose ? song.transpose(transpose) : song;
      return {
        html: new HtmlDivFormatter().format(transposed),
        uniqueChords: showChordDiagrams ? extractUniqueChords(transposed) : [],
      };
    } catch (err) {
      return {
        html: `<pre class="text-red-400">Parse error: ${(err as Error).message}</pre><pre>${escapeHtml(source)}</pre>`,
        uniqueChords: [],
      };
    }
  }, [source, transpose, showChordDiagrams]);

  return (
    <div>
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
