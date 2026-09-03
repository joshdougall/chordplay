/** Where the scroll clock believes the song is, at `now`. */
export type Anchor = { progressMs: number; at: number };

// How far real playback progress may diverge from continuous 1x playback since
// the scroll clock was anchored before we treat it as a seek / track change and
// re-anchor. Must exceed one poll interval (~2s) plus network jitter.
export const SEEK_TOLERANCE_MS = 3000;

/** Fraction of the remaining divergence to absorb per poll. */
const DRIFT_RATE = 0.25;
/** Hard ceiling on one drift step, so a correction is never a visible jump. */
export const MAX_DRIFT_STEP_MS = 250;
/** Ceiling on latency compensation, so a stale sample cannot fling the sheet. */
const MAX_COMPENSATION_MS = 10_000;

/**
 * A polled progress sample is already old by the time it arrives: the server
 * caches now-playing for 1s, the client polls every 2s, and the network adds
 * its own delay. Anchoring the scroll clock straight to that value started the
 * sheet 1-3s behind the music and it stayed there, because the divergence was
 * smaller than SEEK_TOLERANCE_MS and so was deliberately never corrected.
 */
export function compensateProgress(
  polledProgressMs: number,
  fetchedAt: number,
  now: number,
  isPlaying: boolean
): number {
  if (!isPlaying) return polledProgressMs;
  const age = Math.min(Math.max(0, now - fetchedAt), MAX_COMPENSATION_MS);
  return polledProgressMs + age;
}

/** Where the scroll clock believes the song is, at `now`. */
export function virtualProgressAt(
  anchor: Anchor,
  now: number,
  speedMultiplier: number
): number {
  return anchor.progressMs + (now - anchor.at) * speedMultiplier;
}

/**
 * Decide how the scroll clock should track real playback.
 *
 * A large divergence is a seek or a track change, so re-anchor hard. A small
 * one is accumulated latency and jitter, so absorb a capped fraction of it per
 * poll by moving the anchor's progress while leaving its timestamp alone. That
 * converges to zero steady-state error without a jump, and because it shifts
 * the anchor rather than the offset, the user's manual scroll correction and
 * their interaction pause both survive.
 */
export function nextAnchor(
  anchor: Anchor,
  realProgressMs: number,
  now: number,
  durationMs: number,
  toleranceMs: number = SEEK_TOLERANCE_MS
): Anchor & { reason: "seek" | "drift" | "none" } {
  const elapsed = now - anchor.at;
  const divergence = realProgressMs - (anchor.progressMs + elapsed);

  if (isPlaybackSeek(realProgressMs, anchor.progressMs, elapsed, toleranceMs)) {
    return { progressMs: realProgressMs, at: now, reason: "seek" };
  }

  const step = Math.sign(divergence) * Math.min(Math.abs(divergence) * DRIFT_RATE, MAX_DRIFT_STEP_MS);
  if (Math.abs(step) < 1) return { ...anchor, reason: "none" };

  const progressMs = Math.max(0, Math.min(durationMs, anchor.progressMs + step));
  return { progressMs, at: anchor.at, reason: "drift" };
}

/** Decide whether to re-anchor the scroll clock. Returns false for the normal
 * per-poll progress advance (so the user's manual scroll offset and interaction
 * pause survive across polls) and true only for a real discontinuity. */
export function isPlaybackSeek(
  realProgressMs: number,
  anchorProgressMs: number,
  elapsedSinceAnchorMs: number,
  toleranceMs: number = SEEK_TOLERANCE_MS
): boolean {
  const expectedReal = anchorProgressMs + elapsedSinceAnchorMs;
  return Math.abs(realProgressMs - expectedReal) > toleranceMs;
}
