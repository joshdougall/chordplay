import { levenshteinRatio } from "@/lib/library/normalize";
import { logger } from "@/lib/logger";

/** Normalize for validation: lowercase, strip leading "the ", trailing " band",
 * collapse whitespace, strip common punctuation. Keeps artist/title comparisons
 * tolerant of cosmetic differences ("The Beatles" vs "Beatles") without letting
 * entirely different artists through ("Marshall Tucker Band" vs "Tucker Wetmore"). */
export function normalizeForValidation(s: string): string {
  let n = s.toLowerCase().trim();
  // Strip leading "the "
  n = n.replace(/^the\s+/i, "");
  // Strip trailing " band" (Marshall Tucker Band → Marshall Tucker; doesn't strip "bandanna")
  n = n.replace(/\s+band$/i, "");
  // Strip common feat/ft markers (fallback; cleanArtistForSearch should have done this already)
  n = n.replace(/\s+(?:feat\.?|ft\.?|featuring)\s.*$/i, "");
  // Collapse punctuation to spaces
  n = n.replace(/[^\p{L}\p{N}\s]/gu, " ");
  // Collapse whitespace
  n = n.replace(/\s+/g, " ").trim();
  return n;
}

/**
 * Validates that the title and artist returned by a provider match the
 * requested values closely enough. Thresholds tuned from real-world false
 * matches (e.g., "Tucker Wetmore / Wind Up Missin' You" was slipping
 * into "Marshall Tucker Band / 1979" because of the loose 0.60 floor).
 *
 * - **Artist floor 0.75** — strong identity signal, mismatch is catastrophic
 *   (covers, name-collision bands, different artists with one shared word)
 * - **Title floor 0.65** — lower, because external providers often have
 *   stripped parentheticals we didn't strip (remastered, live, etc.) and the
 *   incoming title itself may vary slightly across versions
 */
export function validateResult(
  requested: { artist: string; title: string },
  returned: { artist: string; title: string },
  providerId: string
): boolean {
  const reqTitle = normalizeForValidation(requested.title);
  const reqArtist = normalizeForValidation(requested.artist);
  const retTitle = normalizeForValidation(returned.title);
  const retArtist = normalizeForValidation(returned.artist);

  const ta = levenshteinRatio(reqTitle, retTitle);
  const ar = levenshteinRatio(reqArtist, retArtist);
  const ok = ta >= 0.65 && ar >= 0.75;

  if (!ok) {
    logger.warn(
      {
        provider: providerId,
        requested,
        returned,
        normalizedReqArtist: reqArtist,
        normalizedRetArtist: retArtist,
        titleRatio: ta,
        artistRatio: ar,
        reason: "validator-reject",
      },
      "provider validator rejected"
    );
  }
  return ok;
}
