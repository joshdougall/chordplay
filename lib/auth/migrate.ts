import { readFile, rename, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { decrypt } from "./crypto";

// Legacy file paths (single-user era)
const LEGACY_TOKENS = "tokens.json";
const LEGACY_PREFS = "prefs.json";

type LegacyStored = { blob: string; scopes: string[]; issuedAt: number };

let migrationPromise: Promise<void> | null = null;

/**
 * Run at most once per process boot. If legacy tokens.json exists at the data
 * root, fetch /me with the access token derived from it, then move both
 * tokens.json and prefs.json into /data/users/<userId>/.
 *
 * All errors are swallowed: if migration fails the user can re-authenticate.
 */
export function ensureMigrated(dataDir: string, key: Buffer, fetcher: typeof fetch = fetch): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = runMigration(dataDir, key, fetcher).catch(err => {
      console.error("[migrate] migration failed, user will need to re-login:", err);
    });
  }
  return migrationPromise;
}

async function runMigration(dataDir: string, key: Buffer, fetcher: typeof fetch): Promise<void> {
  const legacyTokensPath = join(dataDir, LEGACY_TOKENS);

  // Check if legacy tokens file exists
  let raw: string;
  try {
    raw = await readFile(legacyTokensPath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return; // nothing to migrate
    throw err;
  }

  const stored = JSON.parse(raw) as LegacyStored;
  let refreshToken: string;
  try {
    refreshToken = decrypt(stored.blob, key);
  } catch {
    console.error("[migrate] could not decrypt legacy tokens, skipping migration");
    return;
  }

  // Get a fresh access token via the refresh token
  const tokenBody = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    // We don't have client_id/secret here; we need them from env.
    // Read them directly from env to avoid circular config dependency.
    client_id: process.env.SPOTIFY_CLIENT_ID ?? ""
  });

  let accessToken: string;
  try {
    const res = await fetcher("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(
            `${process.env.SPOTIFY_CLIENT_ID ?? ""}:${process.env.SPOTIFY_CLIENT_SECRET ?? ""}`
          ).toString("base64")
      },
      body: tokenBody
    });
    if (!res.ok) {
      console.error(`[migrate] token refresh failed (${res.status}), skipping migration`);
      return;
    }
    const data = (await res.json()) as { access_token: string };
    accessToken = data.access_token;
  } catch (err) {
    console.error("[migrate] token refresh error, skipping migration:", err);
    return;
  }

  // Fetch /me to get userId
  let userId: string;
  try {
    const meRes = await fetcher("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!meRes.ok) {
      console.error(`[migrate] /me failed (${meRes.status}), skipping migration`);
      return;
    }
    const me = (await meRes.json()) as { id: string };
    userId = me.id;
  } catch (err) {
    console.error("[migrate] /me error, skipping migration:", err);
    return;
  }

  if (!userId || !/^[A-Za-z0-9._-]+$/.test(userId)) {
    console.error(`[migrate] invalid userId from /me: ${userId}, skipping migration`);
    return;
  }

  // Create per-user dir
  const perUserDir = join(dataDir, "users", userId);
  await mkdir(perUserDir, { recursive: true });

  // Move tokens.json
  try {
    await rename(legacyTokensPath, join(perUserDir, LEGACY_TOKENS));
    console.info(`[migrate] moved tokens.json -> users/${userId}/tokens.json`);
  } catch (err) {
    console.error("[migrate] could not move tokens.json:", err);
    return;
  }

  // Move prefs.json if it exists (best effort)
  const legacyPrefsPath = join(dataDir, LEGACY_PREFS);
  try {
    await rename(legacyPrefsPath, join(perUserDir, LEGACY_PREFS));
    console.info(`[migrate] moved prefs.json -> users/${userId}/prefs.json`);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("[migrate] could not move prefs.json (non-fatal):", err);
    }
  }

  console.info(`[migrate] migration complete for user ${userId}`);
}

// Exported for testing only
export async function _resetMigrationForTest(): Promise<void> {
  migrationPromise = null;
}
