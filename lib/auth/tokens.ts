import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { encrypt, decrypt } from "./crypto";

export type Tokens = {
  refreshToken: string;
  scopes: string[];
  issuedAt: number; // epoch ms
};

type Stored = { blob: string; scopes: string[]; issuedAt: number };

const FILE = "tokens.json";

export async function readTokens(dataDir: string, key: Buffer): Promise<Tokens | null> {
  try {
    const raw = await readFile(join(dataDir, FILE), "utf8");
    const stored = JSON.parse(raw) as Stored;
    const refreshToken = decrypt(stored.blob, key);
    return { refreshToken, scopes: stored.scopes, issuedAt: stored.issuedAt };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function writeTokens(dataDir: string, key: Buffer, tokens: Tokens): Promise<void> {
  const stored: Stored = {
    blob: encrypt(tokens.refreshToken, key),
    scopes: tokens.scopes,
    issuedAt: tokens.issuedAt
  };
  const path = join(dataDir, FILE);
  const tmp = `${path}.tmp.${process.pid}`;
  await writeFile(tmp, JSON.stringify(stored), { mode: 0o600 });
  await rename(tmp, path);
}

export async function deleteTokens(dataDir: string): Promise<void> {
  try { await unlink(join(dataDir, FILE)); }
  catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}
