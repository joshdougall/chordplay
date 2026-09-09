const ROMAN: Record<string, number> = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12,
};

/** Prose capo lines are only read from the preamble. A song is not going to
 *  state its capo forty lines into the second verse, but a lyric might use the
 *  word, and a false capo is worse than none. */
const PREAMBLE_LINES = 25;

/**
 * A capo phrase, anchored so it cannot start mid-word or mid-sentence.
 *
 * The capo token must sit at the start of the line or directly after an opening
 * bracket, an asterisk, or a list separator — the shapes real sheets use
 * ("(Capo 2)", "*Capo 3*", "Tuning: Standard, Capo 2"). A space is deliberately
 * NOT a valid lead-in, which is what keeps "No capo" and "I put a capo on my
 * heart" from matching.
 *
 * Between the word and the number we allow only filler: punctuation, a dash of
 * any width, and the words "on"/"at"/"fret".
 */
const CAPO_NUMERIC =
  /(?:^|[([*,;|]\s*)capo\b[\s:.–—-]*(?:(?:on|at)\s+)?(?:fret\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/i;

const CAPO_ROMAN =
  /(?:^|[([*,;|]\s*)capo\b[\s:.–—-]*(?:(?:on|at)\s+)?(?:fret\s+)?([ivx]{1,4})\b/i;

const DIRECTIVE = /^\{\s*capo\s*:\s*([^}]+)\}$/i;

function fretFrom(token: string): number | null {
  const t = token.trim().toLowerCase();
  const n = /^\d+$/.test(t) ? Number(t) : ROMAN[t];
  if (n === undefined || Number.isNaN(n)) return null;
  if (n < 1 || n > 12) return null;
  return n;
}

/**
 * Find the capo a sheet is written for.
 *
 * The app previously only ever showed a capo it derived from the transpose
 * control, so a sheet carrying its own capo displayed nothing — the player
 * picked up the guitar in the wrong key. Real sheets spell it at least nine
 * ways; `tests/lib/chordpro/capo-formats.test.ts` is the catalogue.
 */
export function parseCapoDirective(source: string): number | null {
  const lines = source.split(/\r?\n/);

  // A {capo:} directive is unambiguous, so honour it anywhere in the file and
  // let it win over prose.
  for (const raw of lines) {
    const m = DIRECTIVE.exec(raw.trim());
    if (!m) continue;
    const fret = fretFrom(m[1]);
    if (fret !== null) return fret;
  }

  let seen = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") continue;
    if (++seen > PREAMBLE_LINES) break;

    // "No capo" / "Capo: none" are statements that there is no capo.
    if (/\b(?:no|without\s+a?)\s+capo\b/i.test(line)) continue;
    if (/capo\b\s*[:\-]?\s*(?:none|n\/a)\b/i.test(line)) continue;

    const m = CAPO_NUMERIC.exec(line) ?? CAPO_ROMAN.exec(line);
    if (!m) continue;
    const fret = fretFrom(m[1]);
    if (fret !== null) return fret;
  }

  return null;
}
