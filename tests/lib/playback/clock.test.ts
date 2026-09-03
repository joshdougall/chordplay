import { describe, it, expect } from "vitest";
import {
  compensateProgress,
  virtualProgressAt,
  nextAnchor,
  isPlaybackSeek,
  nextAnchorForSample,
  SEEK_TOLERANCE_MS,
  MAX_DRIFT_STEP_MS,
} from "@/lib/playback/clock";

describe("compensateProgress", () => {
  it("adds the age of the polled sample while playing", () => {
    // Polled 1800ms ago: the song is really 1800ms further along than the sample says.
    expect(compensateProgress(30_000, 1_000_000, 1_001_800, true)).toBe(31_800);
  });

  it("adds nothing while paused, because progress is not advancing", () => {
    expect(compensateProgress(30_000, 1_000_000, 1_001_800, false)).toBe(30_000);
  });

  it("never subtracts if clocks disagree", () => {
    expect(compensateProgress(30_000, 1_000_000, 999_000, true)).toBe(30_000);
  });

  it("caps compensation so a stale sample cannot fling the sheet forward", () => {
    expect(compensateProgress(30_000, 1_000_000, 1_060_000, true)).toBe(30_000 + 10_000);
  });
});

describe("virtualProgressAt", () => {
  it("advances at 1x with the wall clock", () => {
    expect(virtualProgressAt({ progressMs: 10_000, at: 500 }, 2_500, 1)).toBe(12_000);
  });

  it("advances faster with a speed multiplier", () => {
    expect(virtualProgressAt({ progressMs: 10_000, at: 500 }, 2_500, 1.5)).toBe(13_000);
  });
});

describe("nextAnchor", () => {
  const anchor = { progressMs: 60_000, at: 1_000 };

  it("hard re-anchors on a real seek", () => {
    // 20s ahead of where continuous playback would be: user scrubbed.
    const got = nextAnchor(anchor, 82_000, 3_000, 90_000);
    expect(got.reason).toBe("seek");
    expect(got.progressMs).toBe(82_000);
    expect(got.at).toBe(3_000);
  });

  it("nudges the anchor toward reality inside the tolerance", () => {
    // elapsed 2000, expected 62000, real 62800 -> 800ms behind.
    const got = nextAnchor(anchor, 62_800, 3_000, 90_000);
    expect(got.reason).toBe("drift");
    expect(got.progressMs).toBeGreaterThan(60_000);
    expect(got.progressMs).toBeLessThan(60_800);
    // The anchor time is preserved, so only the clock shifts and the user's
    // manual offset is untouched.
    expect(got.at).toBe(1_000);
  });

  it("nudges backwards too when the sheet has run ahead", () => {
    const got = nextAnchor(anchor, 61_200, 3_000, 90_000);
    expect(got.reason).toBe("drift");
    expect(got.progressMs).toBeLessThan(60_000);
  });

  it("caps a single drift step so the correction is never a visible jump", () => {
    // Just inside tolerance: a proportional step could still be large.
    const got = nextAnchor(anchor, 62_000 + (SEEK_TOLERANCE_MS - 1), 3_000, 90_000);
    expect(got.reason).toBe("drift");
    expect(got.progressMs - 60_000).toBeLessThanOrEqual(MAX_DRIFT_STEP_MS);
  });

  it("leaves the anchor alone when it is already in sync", () => {
    const got = nextAnchor(anchor, 62_000, 3_000, 90_000);
    expect(got.reason).toBe("none");
    expect(got.progressMs).toBe(60_000);
    expect(got.at).toBe(1_000);
  });

  it("converges a 3s bias to under 500ms within a dozen polls", () => {
    let a = { progressMs: 0, at: 0 };
    let real = 3_000; // sheet anchored 3s behind reality
    for (let poll = 1; poll <= 12; poll++) {
      const now = poll * 2_000;
      real = 3_000 + now; // reality keeps advancing at 1x
      a = nextAnchor(a, real, now, 300_000);
    }
    const residual = real - virtualProgressAt(a, 24_000, 1);
    expect(Math.abs(residual)).toBeLessThan(500);
  });
});

// isPlaybackSeek decides whether to re-anchor the scroll clock. It must say NO to
// the normal 2s poll advance (so user scroll offset + pause survive) and YES only
// to real discontinuities (seek / track change).
describe("isPlaybackSeek", () => {
  it("returns false for a normal ~2s poll advance", () => {
    // anchored at 10s, 2s of wall time elapsed, real progress is ~12s
    expect(isPlaybackSeek(12_000, 10_000, 2_000)).toBe(false);
  });

  it("tolerates small network/poll jitter", () => {
    expect(isPlaybackSeek(12_300, 10_000, 2_000)).toBe(false);
  });

  it("returns true for a forward seek", () => {
    expect(isPlaybackSeek(42_000, 10_000, 2_000)).toBe(true);
  });

  it("returns true for a backward seek", () => {
    expect(isPlaybackSeek(4_000, 10_000, 2_000)).toBe(true);
  });

  it("returns true for a track change (progress resets near zero)", () => {
    expect(isPlaybackSeek(500, 200_000, 2_000)).toBe(true);
  });
});

describe("nextAnchorForSample", () => {
  const anchor = { progressMs: 60_000, at: 1_000 };

  it("resets unconditionally on a track change, even when progress looks continuous", () => {
    // The killer case: skip to a track whose progress happens to match where
    // the old anchor expected to be. Divergence is 0, so isPlaybackSeek says
    // no, but this is a different song.
    const got = nextAnchorForSample({
      anchor,
      trackId: "track-b",
      prevTrackId: "track-a",
      realProgressMs: 62_000,
      now: 3_000,
      durationMs: 90_000,
    });
    expect(got.reason).toBe("track-change");
    expect(got.progressMs).toBe(62_000);
    expect(got.at).toBe(3_000);
  });

  it("resets on an early skip, which the tolerance alone would miss", () => {
    // Anchored 2s into track A, skip to track B also 2s in.
    const got = nextAnchorForSample({
      anchor: { progressMs: 2_000, at: 0 },
      trackId: "track-b",
      prevTrackId: "track-a",
      realProgressMs: 2_000,
      now: 0,
      durationMs: 180_000,
    });
    expect(got.reason).toBe("track-change");
    expect(got.progressMs).toBe(2_000);
  });

  it("does not reset when the track is unchanged", () => {
    const got = nextAnchorForSample({
      anchor,
      trackId: "track-a",
      prevTrackId: "track-a",
      realProgressMs: 62_000,
      now: 3_000,
      durationMs: 90_000,
    });
    expect(got.reason).toBe("none");
  });

  it("treats first load (no previous track) as a track change", () => {
    const got = nextAnchorForSample({
      anchor,
      trackId: "track-a",
      prevTrackId: null,
      realProgressMs: 5_000,
      now: 500,
      durationMs: 90_000,
    });
    expect(got.reason).toBe("track-change");
    expect(got.progressMs).toBe(5_000);
  });

  it("still delegates seek and drift to nextAnchor when the track is unchanged", () => {
    const seek = nextAnchorForSample({
      anchor, trackId: "a", prevTrackId: "a",
      realProgressMs: 82_000, now: 3_000, durationMs: 90_000,
    });
    expect(seek.reason).toBe("seek");

    const drift = nextAnchorForSample({
      anchor, trackId: "a", prevTrackId: "a",
      realProgressMs: 62_800, now: 3_000, durationMs: 90_000,
    });
    expect(drift.reason).toBe("drift");
  });

  it("stays put when there is no track at all", () => {
    const got = nextAnchorForSample({
      anchor, trackId: null, prevTrackId: null,
      realProgressMs: 0, now: 3_000, durationMs: 0,
    });
    expect(got.reason).toBe("none");
    expect(got.progressMs).toBe(60_000);
  });
});
