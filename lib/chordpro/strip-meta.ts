/** Strip UG-style preamble blocks from a ChordPro body before rendering.
 *
 * The preamble ends at the first line that is actually part of the song: a
 * section header, a capo instruction, a lyric, or a chord-with-lyric line.
 * Everything before that which looks like scraper furniture is dropped.
 *
 * Two rules are load-bearing and were both wrong before:
 *
 *  - An unrecognised line SKIPS, it does not end the preamble. The old version
 *    flipped a flag on the first line it did not recognise, so one stray line
 *    at the top disabled the whole cleaner. Measured across 29 fetched sheets,
 *    it removed nothing at all from 17 of them.
 *
 *  - A section header ENDS the preamble and is KEPT. The old version treated
 *    "[Intro]" as junk and deleted it, taking the intro chord line with it on
 *    sheets that write chords bare.
 *
 * Capo is never stripped. It changes what the player physically does to the
 * instrument, so losing it silently is the worst possible outcome.
 */
export function stripMetaPreamble(source: string): string {
  const lines = source.split(/\r?\n/);
  const kept: string[] = [];
  let inPreamble = true;
  let directiveBlockEnd = 0;

  for (const line of lines) {
    // Always keep ChordPro directives ({key: C}, {title: ...}, etc.)
    if (/^\s*\{[^}]+\}\s*$/.test(line)) {
      kept.push(line);
      directiveBlockEnd = kept.length;
      continue;
    }

    if (inPreamble) {
      const trimmed = line.trim();

      if (trimmed === "") continue;

      // Capo is content, not credit. Keep it, and let it end the preamble so
      // nothing after it can be eaten either.
      if (isCapoLine(trimmed)) {
        inPreamble = false;
        kept.push(line);
        continue;
      }

      // A section header means the song has started. Keep it and stop.
      if (isSectionHeader(trimmed)) {
        inPreamble = false;
        kept.push(line);
        continue;
      }

      if (isCreditLine(trimmed)) continue;
      if (isLabelledMetaLine(trimmed)) continue;
      if (isRestatedTitleLine(trimmed)) continue;
      if (isRuleLine(trimmed)) continue;
      if (isChordSummaryLine(trimmed)) continue;

      // Unrecognised. If it reads like song content, the preamble is over;
      // otherwise skip it and keep looking, rather than giving up entirely.
      if (looksLikeSongContent(trimmed)) {
        inPreamble = false;
      } else {
        continue;
      }
    }

    kept.push(line);
  }

  // Trim trailing blank lines (but don't eat past the directive block)
  while (kept.length > directiveBlockEnd && kept[kept.length - 1].trim() === "") {
    kept.pop();
  }

  return kept.join("\n");
}

/** "CAPO: 1st FRET", "Capo 2nd fret.", "Capo II", "capo 3" */
function isCapoLine(line: string): boolean {
  return /^capo\b/i.test(line);
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
    /^(?:tabbed\s+by|submitted\s+by|transcribed\s+by|author|email|contact|tuning|key of|strumming|guitar:|bass:|chords\s+by|thanks\s+to|rate\s+this|please\s+rate)\b/i.test(
      line
    ) ||
    /^https?:\/\//i.test(line) ||
    /^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(line)
  );
}

/**
 * "SONG: LAST NIGHT", "TAB BY: DON CZARSKI", "Composer: ...", "Album: ...".
 * A short label followed by a colon and a value. Deliberately conservative:
 * the label must be in a known set, so a lyric containing a colon survives.
 */
function isLabelledMetaLine(line: string): boolean {
  const m = /^([A-Za-z][A-Za-z ]{0,14}):\s*\S/.exec(line);
  if (!m) return false;
  const label = m[1].trim().toLowerCase();
  if (SECTION_WORDS.test(label)) return false;
  return LABELLED_META.has(label);
}

const LABELLED_META = new Set([
  "song", "artist", "band", "title", "video", "tab by", "tabbed by", "tab",
  "composer", "composers", "writer", "writers", "album", "released", "release",
  "year", "genre", "note", "notes", "attention", "difficulty", "bpm", "tempo",
  "time signature", "time", "legend", "date", "source", "arranged by",
  "transcribed by", "submitted by", "email", "contact", "tuning",
]);

/** "SNOWSHOES", "As recorded by Caamp", "(From the 2022 Album LAVENDER DAYS)" */
function isRestatedTitleLine(line: string): boolean {
  if (/^as\s+(?:recorded|performed|played|sung)\s+by\b/i.test(line)) return true;
  if (/^\(.*\b(?:album|release[ds]?|19\d{2}|20\d{2})\b.*\)$/i.test(line)) return true;
  // A bare ALL-CAPS line with no chord content — a restated title.
  if (/^[A-Z0-9][A-Z0-9 '’.,!?&()-]{2,}$/.test(line) && !isChordSummaryLine(line)) return true;
  return false;
}

/** "-----", "=====", "*****", "~~~~~" */
function isRuleLine(line: string): boolean {
  return /^[-=*_~#]{3,}$/.test(line);
}

const SECTION_WORDS =
  /^(?:intro|verse|pre-?chorus|chorus|bridge|outro|solo|guitar\s+solo|interlude|break|coda|refrain|hook|out-?chorus|instrumental|tag|ending)(?:\s*\d+)?$/i;

/** "[Verse 1]", "INTRO:", "Chorus", "[Guitar Solo]" — the song starting. */
function isSectionHeader(line: string): boolean {
  const bare = line.replace(/^\[/, "").replace(/\]$/, "").replace(/:$/, "").trim();
  return SECTION_WORDS.test(bare);
}

/**
 * Does this read like part of the song rather than furniture? Lyrics contain
 * lowercase words; inline chords contain brackets. Either ends the preamble.
 */
function looksLikeSongContent(line: string): boolean {
  if (/\[[A-G][#b]?[^\]]*\]/.test(line)) return true; // inline chord
  if (/[a-z]{2,}/.test(line)) return true;            // lowercase word: a lyric
  return false;
}
