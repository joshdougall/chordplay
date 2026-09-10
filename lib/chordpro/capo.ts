const ROMAN: Record<string, number> = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12,
};

/** Prose capo lines are only read from the preamble. A song is not going to
 *  state its capo forty lines into the second verse, but a lyric might use the
 *  word, and a false capo is worse than none. */
const PREAMBLE_LINES = 25;

// Between "capo" and the fret we allow only filler: punctuation, a dash of any
// width, and the words "on" / "at" / "fret".
const SEP = String.raw`[\s:.–—-]*`;
const NUM = String.raw`(?:(?:on|at)\s+)?(?:fret\s+)?(\d{1,2})(?:st|nd|rd|th)?`;
const ROM = String.raw`(?:(?:on|at)\s+)?(?:fret\s+)?([ivx]{1,4})`;

/**
 * Rule (a): the WHOLE line is nothing but a capo phrase, allowing surrounding
 * decoration and trailing punctuation.
 *
 * An earlier version allowed the capo token to follow any of ( [ * , ; | and
 * that let ordinary prose through: "Well, capo 5 was all he had" parsed as
 * capo 5. Requiring the phrase to be the entire line is what separates
 * "(Capo 2)" from "(capo 3) she whispered".
 */
const WHOLE_NUM = new RegExp(`^[\\s*(\\[]*capo\\b${SEP}${NUM}\\b(?:\\s*fret)?[\\s*)\\].,;!]*$`, "i");
const WHOLE_ROM = new RegExp(`^[\\s*(\\[]*capo\\b${SEP}${ROM}\\b(?:\\s*fret)?[\\s*)\\].,;!]*$`, "i");

/**
 * Rule (b): a metadata line naming the capo among other fields, such as
 * "Tuning: Standard, Capo 2". The line must OPEN with a "Label:" for a comma
 * lead-in to be trusted at all.
 */
const META_LINE = /^[A-Za-z][A-Za-z ]{0,14}:/;
const IN_META_NUM = new RegExp(`[,;|]\\s*capo\\b${SEP}${NUM}\\b`, "i");
const IN_META_ROM = new RegExp(`[,;|]\\s*capo\\b${SEP}${ROM}\\b`, "i");

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

    let m = WHOLE_NUM.exec(line) ?? WHOLE_ROM.exec(line);
    if (!m && META_LINE.test(line)) {
      m = IN_META_NUM.exec(line) ?? IN_META_ROM.exec(line);
    }
    if (!m) continue;
    const fret = fretFrom(m[1]);
    if (fret !== null) return fret;
  }

  return null;
}
