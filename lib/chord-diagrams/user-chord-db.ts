import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import type { ChordEntry } from "./chord-db";

export type UserChordDb = Record<string, ChordEntry>;

const FILE = "user-chord-db.json";

const USER_ID_RE = /^[A-Za-z0-9._-]+$/;

function validateUserId(userId: string): void {
  if (!USER_ID_RE.test(userId)) throw new Error(`Invalid userId: ${userId}`);
}

function pathFor(dataDir: string, userId: string): string {
  return join(dataDir, "users", userId, FILE);
}

export async function readUserChordDb(dataDir: string, userId: string): Promise<UserChordDb> {
  validateUserId(userId);
  try {
    const raw = await readFile(pathFor(dataDir, userId), "utf8");
    return JSON.parse(raw) as UserChordDb;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
}

export async function writeUserChordDb(dataDir: string, userId: string, db: UserChordDb): Promise<void> {
  validateUserId(userId);
  const full = pathFor(dataDir, userId);
  await mkdir(join(dataDir, "users", userId), { recursive: true });
  const tmp = `${full}.tmp.${process.pid}`;
  await writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  await rename(tmp, full);
}
