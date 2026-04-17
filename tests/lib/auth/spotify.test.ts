import { describe, it, expect, beforeEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { writeTokens } from "@/lib/auth/tokens";
import { getAccessToken, clearAccessTokenCache, _setFetcherForTest } from "@/lib/auth/spotify";

describe("getAccessToken", () => {
  let dir: string;
  const key = randomBytes(32);
  const userId = "testuser";

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "chordplay-"));
    clearAccessTokenCache();
    await writeTokens(dir, key, userId, { refreshToken: "r", scopes: [], issuedAt: 0 });
  });

  it("fetches and caches a fresh access token", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({ access_token: "atok", expires_in: 3600, token_type: "Bearer" })
    }));
    _setFetcherForTest(fetcher as unknown as typeof fetch);

    const cfg = { dataPath: dir, appSecret: key, spotifyClientId: "c", spotifyClientSecret: "s" };
    const t1 = await getAccessToken(cfg as any, userId);
    const t2 = await getAccessToken(cfg as any, userId);
    expect(t1).toBe("atok");
    expect(t2).toBe("atok");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("refreshes when cached token is within 30s of expiry", async () => {
    let n = 0;
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({ access_token: `tok-${++n}`, expires_in: 10, token_type: "Bearer" })
    }));
    _setFetcherForTest(fetcher as unknown as typeof fetch);
    const cfg = { dataPath: dir, appSecret: key, spotifyClientId: "c", spotifyClientSecret: "s" };
    const first = await getAccessToken(cfg as any, userId);
    expect(first).toBe("tok-1");
    const second = await getAccessToken(cfg as any, userId);
    expect(second).toBe("tok-2");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("throws if no tokens on disk", async () => {
    clearAccessTokenCache();
    rmSync(dir, { recursive: true, force: true });
    const newDir = mkdtempSync(join(tmpdir(), "chordplay-"));
    const cfg = { dataPath: newDir, appSecret: key, spotifyClientId: "c", spotifyClientSecret: "s" };
    await expect(getAccessToken(cfg as any, userId)).rejects.toThrow(/not authenticated/);
  });

  it("caches independently per userId", async () => {
    const key2 = randomBytes(32);
    const dir2 = mkdtempSync(join(tmpdir(), "chordplay-"));
    await writeTokens(dir2, key2, "user2", { refreshToken: "r2", scopes: [], issuedAt: 0 });

    let n = 0;
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({ access_token: `tok-${++n}`, expires_in: 3600, token_type: "Bearer" })
    }));
    _setFetcherForTest(fetcher as unknown as typeof fetch);

    const cfg1 = { dataPath: dir, appSecret: key, spotifyClientId: "c", spotifyClientSecret: "s" };
    const cfg2 = { dataPath: dir2, appSecret: key2, spotifyClientId: "c", spotifyClientSecret: "s" };

    const t1 = await getAccessToken(cfg1 as any, userId);
    const t2 = await getAccessToken(cfg2 as any, "user2");
    expect(t1).toBe("tok-1");
    expect(t2).toBe("tok-2");
    expect(fetcher).toHaveBeenCalledTimes(2);

    rmSync(dir2, { recursive: true, force: true });
  });

  it("clearAccessTokenCache with userId only clears that user", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({ access_token: "atok", expires_in: 3600, token_type: "Bearer" })
    }));
    _setFetcherForTest(fetcher as unknown as typeof fetch);
    const cfg = { dataPath: dir, appSecret: key, spotifyClientId: "c", spotifyClientSecret: "s" };

    await getAccessToken(cfg as any, userId);
    expect(fetcher).toHaveBeenCalledTimes(1);

    clearAccessTokenCache(userId);
    await getAccessToken(cfg as any, userId);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
