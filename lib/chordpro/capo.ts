const ROMAN: Record<string, number> = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12,
};

/**
 * Find the capo a sheet is written for.
 *
 * The app previously only ever showed a capo it derived from the transpose
 * control, so a sheet carrying its own capo displayed nothing — the player
 * picked up the guitar and played in the wrong key. The library writes it three
 * ways: a {capo: N} directive, "CAPO: 1st FRET", and "Capo II *".
 *
 * Only matched at the start of a line, so a lyric mentioning a capo is ignored.
 */
export function parseCapoDirective(source: string): number | null {
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();

    const directive = /^\{\s*capo\s*:\s*([^}]+)\}$/i.exec(line);
    // "1st" / "2nd" / "3rd" need the ordinal suffix consumed, or \b never matches.
    const prose = /^capo\b[:\s]*(?:fret\s*)?([0-9]{1,2})(?:st|nd|rd|th)?\b/i.exec(line)
      ?? /^capo\b[:\s]*([ivx]{1,4})\b/i.exec(line);
    const m = directive ?? prose;
    if (!m) continue;

    const token = m[1].trim().toLowerCase();
    const fret = /^\d+$/.test(token) ? Number(token) : ROMAN[token];
    if (fret === undefined || Number.isNaN(fret)) continue;
    if (fret < 1 || fret > 12) continue;
    return fret;
  }
  return null;
}
