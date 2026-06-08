import { describe, it, expect } from "vitest";
import { isPlaybackSeek } from "@/components/AutoScroller";

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
