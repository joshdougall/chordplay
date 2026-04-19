import { franc } from "franc-min";
import { logger } from "@/lib/logger";

/**
 * Quick language check for a chord sheet's lyric content. We only care about
 * catching egregiously-wrong matches (e.g., a Norwegian sheet returned for an
 * English Morgan Wallen track). We don't want to reject things like Spanish
 * or French covers — those are valid covers someone may have played.
 *
 * Strategy:
 *  1. Extract only the LYRIC text from the content (drop chord markers like [Am]
 *     and directives like {title: ...})
 *  2. If less than 40 chars of lyric text, skip the check (too little signal)
 *  3. Run franc-min to get ISO 639-3 language code
 *  4. If the detected lang is in the "accept" set (English + common cover langs),
 *     accept. Otherwise reject.
 *
 * Franc returns `"und"` (undetermined) for short or unusual input — accept those.
 */

// Languages we accept. ISO 639-3 codes.
// Broad Western set — if a user plays a Spanish/French/German cover, we don't
// want to block the corresponding chord sheet.
const ACCEPTED_LANGS = new Set([
  "eng", // English
  "spa", // Spanish
  "fra", // French
  "deu", // German
  "ita", // Italian
  "por", // Portuguese
  "nld", // Dutch
  "und", // franc couldn't decide — pass through
]);

/** Extract plain lyric text from a chord sheet: strip [Chord] markers, {directives},
 * section headers like [Verse 1], and heavy whitespace. */
export function extractLyrics(content: string): string {
  let text = content;
  // Strip ChordPro directives
  text = text.replace(/\{[^}]+\}/g, " ");
  // Strip all [...] markers (chords AND section labels)
  text = text.replace(/\[[^\]]+\]/g, " ");
  // Strip UG-style markers if any slipped through
  text = text.replace(/\[\/?(?:ch|tab)\]/gi, " ");
  // Collapse whitespace
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

/** Returns true if content language is plausibly compatible with an English-speaking
 * audience. False positives here (accepting Norwegian) are much worse than false
 * negatives (rejecting an English sheet). */
export function isAcceptableLanguage(content: string, context: { providerId: string; artist: string; title: string } = { providerId: "", artist: "", title: "" }): boolean {
  const lyrics = extractLyrics(content);
  if (lyrics.length < 40) return true; // not enough signal — let it through

  const lang = franc(lyrics, { minLength: 10 });
  const ok = ACCEPTED_LANGS.has(lang);
  if (!ok) {
    logger.warn(
      { provider: context.providerId, artist: context.artist, title: context.title, detectedLang: lang, lyricsPreview: lyrics.slice(0, 120), reason: "language-reject" },
      "provider language-rejected"
    );
  }
  return ok;
}
