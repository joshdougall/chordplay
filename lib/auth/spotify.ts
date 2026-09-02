import { readTokens, writeTokens } from "./tokens";
import type { Config } from "../config";
import { logger } from "@/lib/logger";

type Cached = { accessToken: string; expiresAt: number };
const caches = new Map<string, Cached>();
let fetcher: typeof fetch = fetch;

export function _setFetcherForTest(f: typeof fetch) { fetcher = f; }
export function clearAccessTokenCache(userId?: string) {
  if (userId !== undefined) {
    caches.delete(userId);
  } else {
    caches.clear();
  }
}

const REFRESH_MARGIN_MS = 30_000;

/**
 * In-flight refreshes, keyed by user.
 *
 * There is an await between the cache check and the cache write, and nothing
 * coalesced callers, so every expiry produced a burst: /api/now-playing polls
 * every 2s, /api/auth/status and any playback action land alongside it, and each
 * one independently POSTed to Spotify and wrote tokens.json. With refresh-token
 * rotation only one write survived last-writer-wins, and if the survivor was not
 * the token Spotify considered current the user was logged out for good.
 *
 * Same shape as lib/spotify/now-playing-cache.ts, which already does this.
 */
const inflight = new Map<string, Promise<string>>();

export async function getAccessToken(cfg: Config, userId: string): Promise<string> {
  const cached = caches.get(userId);
  if (cached && cached.expiresAt - Date.now() > REFRESH_MARGIN_MS) {
    return cached.accessToken;
  }

  const existing = inflight.get(userId);
  if (existing) return existing;

  // Cleared in a finally so a failure is not cached: the next caller retries.
  const p = refreshAccessToken(cfg, userId).finally(() => inflight.delete(userId));
  inflight.set(userId, p);
  return p;
}

async function refreshAccessToken(cfg: Config, userId: string): Promise<string> {
  const tokens = await readTokens(cfg.dataPath, cfg.appSecret, userId);
  if (!tokens) throw new Error("not authenticated");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refreshToken,
    client_id: cfg.spotifyClientId
  });
  const res = await fetcher("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${cfg.spotifyClientId}:${cfg.spotifyClientSecret}`).toString("base64")
    },
    body
  });
  if (!res.ok) {
    logger.warn({ userId, status: res.status }, "spotify token refresh failed");
    throw new Error(`token refresh failed: ${res.status}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number; refresh_token?: string };
  const entry: Cached = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  caches.set(userId, entry);

  // Spotify sometimes rotates refresh tokens; persist if so.
  if (data.refresh_token && data.refresh_token !== tokens.refreshToken) {
    await writeTokens(cfg.dataPath, cfg.appSecret, userId, {
      ...tokens,
      refreshToken: data.refresh_token,
      issuedAt: Date.now()
    });
  }
  return entry.accessToken;
}
