import { readFile, writeFile, rename, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
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
  try {
    const raw = await readFile(join(userDir(dataDir, userId), FILE), "utf8");
    const stored = JSON.parse(raw) as Stored;
    const refreshToken = decrypt(stored.blob, key);
    return { refreshToken, scopes: stored.scopes, issuedAt: stored.issuedAt };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
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
  const path = join(dir, FILE);
  const tmp = `${path}.tmp.${process.pid}`;
  await writeFile(tmp, JSON.stringify(stored), { mode: 0o600 });
  await rename(tmp, path);
}

export async function deleteTokens(dataDir: string, userId: string): Promise<void> {
  validateUserId(userId);
  try { await unlink(join(userDir(dataDir, userId), FILE)); }
  catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}
