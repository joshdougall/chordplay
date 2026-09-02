import { describe, it, expect } from "vitest";
import { playbackErrorFor } from "@/lib/spotify/playback-errors";

describe("playbackErrorFor", () => {
  it("returns null for a success, so the happy path is untouched", () => {
    expect(playbackErrorFor(200)).toBeNull();
    expect(playbackErrorFor(204)).toBeNull();
  });

  it("explains the no-active-device case in words a person can act on", () => {
    // This is the one I hit: pressed play, nothing happened, no feedback at all,
    // because the route returned {ok:true} with status 200 on a 404.
    const e = playbackErrorFor(404)!;
    expect(e.status).toBe(404);
    expect(e.message).toMatch(/device/i);
    expect(e.message).toMatch(/start playback/i);
  });

  it("keeps the existing scope message for 403", () => {
    expect(playbackErrorFor(403)!.message).toMatch(/permission|scope/i);
  });

  it("names Premium for 403-style restrictions and rate limiting for 429", () => {
    expect(playbackErrorFor(429)!.message).toMatch(/too many|slow/i);
  });

  it("still reports an unexpected status rather than claiming success", () => {
    const e = playbackErrorFor(502)!;
    expect(e.status).toBe(502);
    expect(e.message).toBeTruthy();
  });
});
