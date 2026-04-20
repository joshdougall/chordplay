import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { encrypt } from "@/lib/auth/crypto";
import { ensureMigrated, _resetMigrationForTest } from "@/lib/auth/migrate";

function makeLegacyTokensBlob(key: Buffer, refreshToken: string): string {
  const blob = encrypt(refreshToken, key);
  return JSON.stringify({ blob, scopes: ["user-read-playback-state"], issuedAt: 1000 });
}

function makeSpotifyFetcher(opts: { userId: string; accessToken?: string; tokenOk?: boolean; meOk?: boolean }) {
  const at = opts.accessToken ?? "access-token-123";
  const tokenOk = opts.tokenOk ?? true;
  const meOk = opts.meOk ?? true;

  return async (url: string | URL | Request, _init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url.toString();
    if (urlStr.includes("/api/token")) {
      return {
        ok: tokenOk,
        status: tokenOk ? 200 : 400,
        json: async () => ({ access_token: at })
      } as Response;
    }
    if (urlStr.includes("/v1/me")) {
      return {
        ok: meOk,
        status: meOk ? 200 : 401,
        json: async () => ({ id: opts.userId })
      } as Response;
    }
    throw new Error(`Unexpected fetch to ${urlStr}`);
  };
}

describe("migrate", () => {
  let dir: string;
  const key = randomBytes(32);

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "chordplay-migrate-"));
    await _resetMigrationForTest();
    // Set env vars needed by migration
    process.env.SPOTIFY_CLIENT_ID = "test-client-id";
    process.env.SPOTIFY_CLIENT_SECRET = "test-client-secret";
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    delete process.env.SPOTIFY_CLIENT_ID;
    delete process.env.SPOTIFY_CLIENT_SECRET;
  });

  it("does nothing when no legacy tokens.json exists", async () => {
    const fetcher = makeSpotifyFetcher({ userId: "user1" });
    await ensureMigrated(dir, key, fetcher as typeof fetch);
    expect(existsSync(join(dir, "users"))).toBe(false);
  });

  it("migrates legacy tokens.json to per-user directory", async () => {
    await writeFile(join(dir, "tokens.json"), makeLegacyTokensBlob(key, "refresh-token-abc"), "utf8");

    const fetcher = makeSpotifyFetcher({ userId: "spotify_user_42" });
    await ensureMigrated(dir, key, fetcher as typeof fetch);

    expect(existsSync(join(dir, "tokens.json"))).toBe(false);
    expect(existsSync(join(dir, "users", "spotify_user_42", "tokens.json"))).toBe(true);
  });

  it("migrates legacy prefs.json alongside tokens.json", async () => {
    await writeFile(join(dir, "tokens.json"), makeLegacyTokensBlob(key, "refresh-token-abc"), "utf8");
    await writeFile(join(dir, "prefs.json"), JSON.stringify({ autoScroll: true, songPreferences: {}, trackOverrides: {}, songTranspose: {} }), "utf8");

    const fetcher = makeSpotifyFetcher({ userId: "user123" });
    await ensureMigrated(dir, key, fetcher as typeof fetch);

    expect(existsSync(join(dir, "prefs.json"))).toBe(false);
    expect(existsSync(join(dir, "users", "user123", "prefs.json"))).toBe(true);
  });

  it("is idempotent — second call does not re-run migration", async () => {
    await writeFile(join(dir, "tokens.json"), makeLegacyTokensBlob(key, "refresh-token-abc"), "utf8");

    let callCount = 0;
    const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
      callCount++;
      return makeSpotifyFetcher({ userId: "user1" })(url, init);
    };

    await ensureMigrated(dir, key, fetcher as typeof fetch);
    await ensureMigrated(dir, key, fetcher as typeof fetch);

    // Only one migration run (the second call returns the cached promise)
    expect(callCount).toBeLessThanOrEqual(2); // token + /me calls, not doubled
  });

  it("swallows error when token refresh fails", async () => {
    await writeFile(join(dir, "tokens.json"), makeLegacyTokensBlob(key, "refresh-token-abc"), "utf8");

    const fetcher = makeSpotifyFetcher({ userId: "user1", tokenOk: false });
    await expect(ensureMigrated(dir, key, fetcher as typeof fetch)).resolves.toBeUndefined();
    // Legacy file stays untouched since migration aborted
    expect(existsSync(join(dir, "tokens.json"))).toBe(true);
  });

  it("swallows error when /me fails", async () => {
    await writeFile(join(dir, "tokens.json"), makeLegacyTokensBlob(key, "refresh-token-abc"), "utf8");

    const fetcher = makeSpotifyFetcher({ userId: "user1", meOk: false });
    await expect(ensureMigrated(dir, key, fetcher as typeof fetch)).resolves.toBeUndefined();
    expect(existsSync(join(dir, "tokens.json"))).toBe(true);
  });

  it("migrates tokens content correctly (still decryptable after move)", async () => {
    await writeFile(join(dir, "tokens.json"), makeLegacyTokensBlob(key, "my-refresh-token"), "utf8");

    const fetcher = makeSpotifyFetcher({ userId: "user_xyz" });
    await ensureMigrated(dir, key, fetcher as typeof fetch);

    const raw = await readFile(join(dir, "users", "user_xyz", "tokens.json"), "utf8");
    const { readTokens } = await import("@/lib/auth/tokens");
    const tokens = await readTokens(dir, key, "user_xyz");
    expect(tokens?.refreshToken).toBe("my-refresh-token");
  });
});
