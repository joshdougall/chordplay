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

export type SampleReason = "track-change" | "seek" | "drift" | "none";

/**
 * Decide the next anchor for an incoming progress sample, track identity
 * included.
 *
 * nextAnchor alone cannot see a track change: it compares progress values, so
 * skipping to a different song that happens to be at a similar position looks
 * like continuous playback and the old anchor survives, seconds out. The RAF
 * effect used to be torn down whenever durationMs changed, which masked this;
 * with the clock in a hook that no longer happens, and two tracks of the same
 * length would never re-anchor at all.
 */
export function nextAnchorForSample({
  anchor,
  trackId,
  prevTrackId,
  realProgressMs,
  now,
  durationMs,
  toleranceMs = SEEK_TOLERANCE_MS,
}: {
  anchor: Anchor;
  trackId: string | null;
  prevTrackId: string | null;
  realProgressMs: number;
  now: number;
  durationMs: number;
  toleranceMs?: number;
}): Anchor & { reason: SampleReason } {
  if (trackId === null) return { ...anchor, reason: "none" };
  if (trackId !== prevTrackId) {
    return { progressMs: realProgressMs, at: now, reason: "track-change" };
  }
  return nextAnchor(anchor, realProgressMs, now, durationMs, toleranceMs);
}

/**
 * Move the scroll anchor to where the sheet currently is, so a speed change
 * takes effect from here rather than snapping to a recomputed position. The
 * position reached so far was reached at the OLD speed, hence prevSpeed.
 */
export function reanchorForSpeedChange(
  scrollAnchor: Anchor,
  prevSpeed: number,
  now: number
): Anchor {
  return { progressMs: virtualProgressAt(scrollAnchor, now, prevSpeed), at: now };
}

export type ClockState = { anchor: Anchor; scrollAnchor: Anchor };
export type ClockReason = "track-change" | "pause" | "resume" | "seek" | "drift" | "none";

/**
 * Advance both playback anchors for one incoming sample.
 *
 * `anchor` tracks real playback; `scrollAnchor` is the same clock read at the
 * user's chosen scroll speed. Pure, so every transition below is unit-testable.
 *
 * Order matters: track change, then a play/pause transition, then the paused
 * hold, then seek, then drift. A play/pause transition is
 * a discontinuity and hard re-anchors both: drift deliberately moves
 * `progressMs` without moving `at`, so a stored `progressMs` drifts far behind
 * the true position over a song, and reading it while paused snapped the strip
 * back to the first chord. While paused, every sample is exact (no latency to
 * compensate), so both anchors stay pinned to it and the seek detector never
 * fires on accumulated paused divergence.
 */
export function nextClockState(
  state: ClockState,
  {
    trackId,
    prevTrackId,
    realProgressMs,
    now,
    durationMs,
    isPlaying,
    wasPlaying,
    toleranceMs = SEEK_TOLERANCE_MS,
  }: {
    trackId: string | null;
    prevTrackId: string | null;
    realProgressMs: number;
    now: number;
    durationMs: number;
    isPlaying: boolean;
    wasPlaying: boolean;
    toleranceMs?: number;
  }
): ClockState & { reason: ClockReason } {
  const pin = (reason: ClockReason) => {
    const a: Anchor = { progressMs: realProgressMs, at: now };
    return { anchor: a, scrollAnchor: { ...a }, reason };
  };

  if (trackId === null) return { ...state, reason: "none" };

  // nextAnchorForSample decides whether trackId changed (a "track-change"
  // reset) or the sample is just a seek/steady-state update; this reducer
  // layers the play/pause and resume transitions on top of that.
  const next = nextAnchorForSample({
    anchor: state.anchor,
    trackId,
    prevTrackId,
    realProgressMs,
    now,
    durationMs,
    toleranceMs,
  });

  if (next.reason === "track-change") return pin("track-change");
  if (isPlaying !== wasPlaying) return pin(isPlaying ? "resume" : "pause");
  if (!isPlaying) return pin("none");
  if (next.reason === "seek") return pin("seek");
  if (next.reason === "none") return { ...state, reason: "none" };

  // A drift step is a fixed latency correction, so the scroll anchor takes the
  // same delta while keeping its own timestamp. Applying it to `progressMs`
  // rather than `at` means the correction does not scale with speedMultiplier.
  const delta = next.progressMs - state.anchor.progressMs;
  return {
    anchor: { progressMs: next.progressMs, at: next.at },
    scrollAnchor: {
      progressMs: state.scrollAnchor.progressMs + delta,
      at: state.scrollAnchor.at,
    },
    reason: "drift",
  };
}
