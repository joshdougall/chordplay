import { readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { atomicWrite } from "@/lib/fs/atomic";
import { logger } from "@/lib/logger";
import { DEFAULT_PREFS, type Prefs } from "./defaults";

export type { Prefs };


const DEFAULT = DEFAULT_PREFS;
const FILE = "prefs.json";
const USER_ID_RE = /^[A-Za-z0-9._-]+$/;

function validateUserId(userId: string): void {
  if (!USER_ID_RE.test(userId)) throw new Error(`Invalid userId: ${userId}`);
}

function userDir(dataDir: string, userId: string): string {
  return join(dataDir, "users", userId);
}

export async function readPrefs(dataDir: string, userId: string): Promise<Prefs> {
  validateUserId(userId);
  let raw: string;
  try {
    raw = await readFile(join(userDir(dataDir, userId), FILE), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { ...DEFAULT };
    throw err;
  }
  try {
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch (err) {
    // Unparseable prefs must degrade to defaults, not 500. A throw here left the
    // client with prefs=null forever, disabling transpose, auto-scroll and split
    // view, and PUT reads before it writes so the UI could not overwrite the file.
    logger.error({ err, userId }, "prefs.json unparseable; falling back to defaults");
    return { ...DEFAULT };
  }
}

export async function writePrefs(dataDir: string, userId: string, prefs: Prefs): Promise<void> {
  validateUserId(userId);
  const dir = userDir(dataDir, userId);
  await mkdir(dir, { recursive: true });
  await atomicWrite(join(dir, FILE), JSON.stringify(prefs, null, 2));
}
