import { readFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { atomicWrite } from "@/lib/fs/atomic";
import { logger } from "@/lib/logger";
import { encrypt, decrypt } from "./crypto";

export type Tokens = {
  refreshToken: string;
  scopes: string[];
  issuedAt: number; // epoch ms
};

type Stored = { blob: string; scopes: string[]; issuedAt: number };

const FILE = "tokens.json";
const USER_ID_RE = /^[A-Za-z0-9._-]+$/;

function validateUserId(userId: string): void {
  if (!USER_ID_RE.test(userId)) throw new Error(`Invalid userId: ${userId}`);
}

function userDir(dataDir: string, userId: string): string {
  return join(dataDir, "users", userId);
}

export async function readTokens(dataDir: string, key: Buffer, userId: string): Promise<Tokens | null> {
  validateUserId(userId);
  let raw: string;
  try {
    raw = await readFile(join(userDir(dataDir, userId), FILE), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  try {
    const stored = JSON.parse(raw) as Stored;
    const refreshToken = decrypt(stored.blob, key);
    return { refreshToken, scopes: stored.scopes, issuedAt: stored.issuedAt };
  } catch (err) {
    // Corrupt or undecryptable credentials are functionally absent. Returning
    // null degrades to "reconnect Spotify", which is the recoverable path; a
    // throw here 500s every authenticated route for that user instead.
    logger.error({ err, userId }, "tokens.json unreadable; treating as disconnected");
    return null;
  }
}

export async function writeTokens(dataDir: string, key: Buffer, userId: string, tokens: Tokens): Promise<void> {
  validateUserId(userId);
  const dir = userDir(dataDir, userId);
  await mkdir(dir, { recursive: true });
  const stored: Stored = {
    blob: encrypt(tokens.refreshToken, key),
    scopes: tokens.scopes,
    issuedAt: tokens.issuedAt
  };
  await atomicWrite(join(dir, FILE), JSON.stringify(stored), { mode: 0o600 });
}

export async function deleteTokens(dataDir: string, userId: string): Promise<void> {
  validateUserId(userId);
  try { await unlink(join(userDir(dataDir, userId), FILE)); }
  catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}
