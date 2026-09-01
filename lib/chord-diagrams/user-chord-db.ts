import { readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { atomicWrite } from "@/lib/fs/atomic";
import { logger } from "@/lib/logger";
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
  let raw: string;
  try {
    raw = await readFile(pathFor(dataDir, userId), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
  try {
    return JSON.parse(raw) as UserChordDb;
  } catch (err) {
    logger.error({ err, userId }, "user-chord-db.json unparseable; falling back to empty");
    return {};
  }
}

export async function writeUserChordDb(dataDir: string, userId: string, db: UserChordDb): Promise<void> {
  validateUserId(userId);
  const full = pathFor(dataDir, userId);
  await mkdir(join(dataDir, "users", userId), { recursive: true });
  await atomicWrite(full, JSON.stringify(db, null, 2));
}
