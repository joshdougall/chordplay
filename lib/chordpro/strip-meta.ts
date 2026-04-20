/** Strip UG-style preamble blocks from a ChordPro body before rendering.
 * Keeps ChordPro {directives} intact. Removes:
 *   - Standalone chord-only summary lines (e.g. "C5 D5 A5 B5 C5 B5 G5") that
 *     appear BEFORE any lyric/chord-with-lyric content
 *   - "Tabbed by X", "Email: ...", "Tuning: ..." style credit lines at top
 *   - Bare section headers (INTRO:, VERSE:, CHORUS:) at top
 *   - Leading blank lines
 * Stops stripping once it encounters a line with mixed chord+lyric content
 * or a lyric line. */
export function stripMetaPreamble(source: string): string {
  const lines = source.split(/\r?\n/);
  const kept: string[] = [];
  let inPreamble = true;
  let directiveBlockEnd = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Always keep ChordPro directives ({key: C}, {title: ...}, etc.)
    if (/^\s*\{[^}]+\}\s*$/.test(line)) {
      kept.push(line);
      directiveBlockEnd = kept.length;
      continue;
    }

    if (inPreamble) {
      const trimmed = line.trim();
      if (trimmed === "") continue;
      if (isChordSummaryLine(trimmed)) continue;
      if (isCreditLine(trimmed)) continue;
      if (isBareSectionHeader(trimmed)) continue;
      // Has lyric content or inline chord+lyric — preamble is over
      inPreamble = false;
    }

    kept.push(line);
  }

  // Trim trailing blank lines (but don't eat past the directive block)
  while (kept.length > directiveBlockEnd && kept[kept.length - 1].trim() === "") {
    kept.pop();
  }

  return kept.join("\n");
}

/** "C5 D5 A5 B5 C5 B5 G5" — every token is a chord symbol, no lyric words. */
function isChordSummaryLine(line: string): boolean {
  const tokens = line.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every(t =>
    /^[A-G][#b]?(?:m|M|maj|min|aug|dim|sus|add)?[0-9]*(?:\/[A-G][#b]?)?$/.test(t)
  );
}

function isCreditLine(line: string): boolean {
  return (
    /^(?:tabbed\s+by|submitted\s+by|author|email|contact|tuning|capo|key of|strumming|guitar:|bass:|chords\s+by)\b/i.test(
      line
    ) ||
    /^https?:\/\//i.test(line) ||
    /^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(line)
  );
}

function isBareSectionHeader(line: string): boolean {
  // Matches lines like "INTRO: A", "INTRO", "Verse 1:", "[Verse 1]"
  return /^\[?(?:intro|verse|pre-?chorus|chorus|bridge|outro|solo|interlude|break|coda|refrain|hook)(?:\s+\d+)?\]?:?(?:\s+[A-G][#b]?(?:m|M|maj|min|aug|dim|sus|add)?[0-9]*)?$/i.test(
    line
  );
}
