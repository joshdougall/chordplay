import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { getAccessToken, clearAccessTokenCache, _setFetcherForTest } from "@/lib/auth/spotify";
import { writeTokens, readTokens } from "@/lib/auth/tokens";

let dir: string;
let key: Buffer;
const USER = "joshdougall";

function cfg() {
  return {
    dataPath: dir, appSecret: key,
    spotifyClientId: "id", spotifyClientSecret: "secret",
  } as never;
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "chordplay-refresh-"));
  key = randomBytes(32);
  clearAccessTokenCache();
  await writeTokens(dir, key, USER, { refreshToken: "rt-original", scopes: [], issuedAt: 1 });
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

describe("getAccessToken under concurrent callers", () => {
  it("refreshes ONCE for a burst of callers, not once each", async () => {
    // Real scenario: the access token crosses the 30s margin and /api/now-playing
    // (2s poll), /api/auth/status and a playback action all land together.
    let calls = 0;
    _setFetcherForTest(async () => {
      calls++;
      await new Promise(r => setTimeout(r, 20));
      return { ok: true, json: async () => ({ access_token: "at-1", expires_in: 3600 }) } as never;
    });

    const tokens = await Promise.all(
      Array.from({ length: 8 }, () => getAccessToken(cfg(), USER))
    );

    expect(new Set(tokens)).toEqual(new Set(["at-1"]));
    expect(calls).toBe(1);
  });

  it("does not lose a rotated refresh token to a concurrent write", async () => {
    // With no dedup, each caller wrote tokens.json and only one rotation
    // survived last-writer-wins. If the survivor is not the one Spotify
    // considers current, the user is logged out with no way back.
    _setFetcherForTest(async () => {
      await new Promise(r => setTimeout(r, 10));
      return {
        ok: true,
        json: async () => ({ access_token: "at-2", expires_in: 3600, refresh_token: "rt-rotated" }),
      } as never;
    });

    await Promise.all(Array.from({ length: 6 }, () => getAccessToken(cfg(), USER)));

    const stored = await readTokens(dir, key, USER);
    expect(stored?.refreshToken).toBe("rt-rotated");
  });

  it("lets a later caller retry after a failure rather than caching the error", async () => {
    let calls = 0;
    _setFetcherForTest(async () => {
      calls++;
      if (calls === 1) return { ok: false, status: 502, json: async () => ({}) } as never;
      return { ok: true, json: async () => ({ access_token: "at-3", expires_in: 3600 }) } as never;
    });

    await expect(getAccessToken(cfg(), USER)).rejects.toThrow();
    await expect(getAccessToken(cfg(), USER)).resolves.toBe("at-3");
  });
});
