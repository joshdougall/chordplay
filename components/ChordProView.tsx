"use client";

import { useEffect, useMemo, useRef } from "react";
import { ChordProParser, HtmlDivFormatter } from "chordsheetjs";
import type { Song } from "chordsheetjs";
import { ChordDiagram } from "@/components/ChordDiagram";
import { detectKey, capoSuggestion, normalizeChordRoot } from "@/lib/music/key-detection";
import { parseCapoDirective } from "@/lib/chordpro/capo";
import { isPositionalSheet, renderPositional } from "@/lib/chordpro/positional";
import { stripMetaPreamble } from "@/lib/chordpro/strip-meta";
import { isChordName, extractUniqueChords } from "@/lib/chordpro/extract-chords";
import { sanitizeChordHtml } from "@/lib/chordpro/sanitize";

const CHROMATIC_KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function transposeKey(key: string, semitones: number): string {
  if (semitones === 0) return key;
  const root = normalizeChordRoot(key);
  if (!root) return key;
  const idx = CHROMATIC_KEYS.indexOf(root);
  if (idx < 0) return key;
  return CHROMATIC_KEYS[((idx + semitones) % 12 + 12) % 12];
}

function hasAsciiTabLines(source: string): boolean {
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
  chordStripActive = false,
}: {
  source: string;
  transpose?: number;
  showChordDiagrams?: boolean;
  /** When true the strip owns the mobile top band, so the horizontal
   *  diagram palette stands down rather than competing for it. */
  chordStripActive?: boolean;
}) {
  const containsTab = useMemo(() => hasAsciiTabLines(source), [source]);

  // 44 of 47 library sheets place their chords by column. HtmlDivFormatter
  // discards that whitespace, so those sheets rendered every chord flush left
  // and lost the timing the sheet exists to convey. Render them as a <pre>
  // instead, which preserves the columns exactly, with the chord tokens still
  // wrapped so styling and click-to-diagram keep working.
  // Strip the scraper preamble BEFORE deciding how to render. Feeding the raw
  // source here meant positional sheets still opened on someone's credits
  // while inline sheets did not.
  const stripped = useMemo(() => stripMetaPreamble(source), [source]);

  const positional = useMemo(
    () => (isPositionalSheet(stripped) ? renderPositional(stripped, transpose) : null),
    [stripped, transpose]
  );

  const { html, uniqueChords: parsedChords, keyLabel, capo, sheetCapo } = useMemo(() => {
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
        html: sanitizeChordHtml(new HtmlDivFormatter().format(transposed)),
        uniqueChords: showChordDiagrams ? extractUniqueChords(transposed) : [],
        keyLabel,
        capo,
        sheetCapo: parseCapoDirective(source),
      };
    } catch (err) {
      return {
        html: sanitizeChordHtml(`<pre class="text-red-400">Parse error: ${(err as Error).message}</pre><pre>${escapeHtml(source)}</pre>`),
        uniqueChords: [],
        keyLabel: null,
        capo: null,
        sheetCapo: parseCapoDirective(source),
      };
    }
  }, [source, transpose, showChordDiagrams]);

  // Same chord list either way, but taken from whichever renderer is showing.
  const uniqueChords = positional && showChordDiagrams ? positional.uniqueChords : parsedChords;

  const rootRef = useRef<HTMLDivElement | null>(null);
  // Widened to HTMLElement: positional sheets render into a <pre>, inline into a <div>.
  const sheetRef = useRef<HTMLElement | null>(null);

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
      {/* One sticky context, so the key line and the strip cannot overlap. Two
          independent `sticky top-0` elements put whichever had the lower z-index
          underneath the other. */}
      <div className="sticky top-0 z-20" style={{ backgroundColor: "var(--bg)" }}>
        {(keyLabel || sheetCapo) && (
          <div className="mb-2 py-1 text-xs uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
            {[
              keyLabel ? `Key · ${keyLabel}` : null,
              sheetCapo ? `capo ${sheetCapo}` : null,
              capo ? `capo ${capo.capoFret} → play in ${capo.shapeKey} shapes` : null,
            ].filter(Boolean).join(" · ")}
          </div>
        )}
        {showChordDiagrams && uniqueChords.length > 0 && !chordStripActive && (
          <div
            className="md:hidden chord-palette flex gap-3 overflow-x-auto py-2 mb-3"
            style={{ borderBottom: "1px solid var(--border)" }}
            aria-label="Chord diagrams"
          >
            {uniqueChords.map(c => (
              <div key={c} data-chord-diagram={c} className="shrink-0 transition-transform">
                <ChordDiagram name={c} size="sm" />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="md:flex md:flex-row md:gap-4">
        <div className="flex-1 min-w-0">
          {positional ? (
            <pre ref={el => { sheetRef.current = el; }} className="chordpro-pre font-mono">
              {positional.lines.map((line, i) => (
                <span key={i}>
                  {line.segments.map((seg, j) =>
                    seg.isChord ? (
                      <span key={j} className="chord" role="presentation" data-chord={seg.text}>
                        {seg.text}
                      </span>
                    ) : (
                      seg.text
                    )
                  )}
                  {"\n"}
                </span>
              ))}
            </pre>
          ) : (
            <div
              ref={el => { sheetRef.current = el; }}
              className="chordpro prose prose-invert max-w-none font-mono"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
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
                <div key={c} data-chord-diagram={c}>
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
