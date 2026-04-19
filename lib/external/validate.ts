import { levenshteinRatio } from "@/lib/library/normalize";
import { logger } from "@/lib/logger";

/**
 * Validates that the title and artist returned by a provider match the
 * requested values closely enough (both >= 0.60 Levenshtein ratio).
 */
export function validateResult(
  requested: { artist: string; title: string },
  returned: { artist: string; title: string },
  providerId: string
): boolean {
  const norm = (s: string) => s.toLowerCase().trim();
  const ta = levenshteinRatio(norm(requested.title), norm(returned.title));
  const ar = levenshteinRatio(norm(requested.artist), norm(returned.artist));
  const ok = ta >= 0.60 && ar >= 0.60;
  if (!ok) {
    logger.warn(
      {
        provider: providerId,
        requested,
        returned,
        titleRatio: ta,
        artistRatio: ar,
        reason: "validator-reject",
      },
      "provider validator rejected"
    );
  }
  return ok;
}
