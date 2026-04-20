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

export async function getAccessToken(cfg: Config, userId: string): Promise<string> {
  const cached = caches.get(userId);
  if (cached && cached.expiresAt - Date.now() > REFRESH_MARGIN_MS) {
    return cached.accessToken;
  }
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
