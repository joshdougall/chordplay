import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { join } from "node:path";

export type Prefs = {
  autoScroll: boolean;
  autoScrollSpeed?: number;
  showChordDiagrams: boolean;
  songPreferences: Record<string, "chords" | "tab">;
  trackOverrides: Record<string, string>;
  songTranspose: Record<string, number>;
  preferredVersion: Record<string, string>;
  splitView?: Record<string, boolean>;
};

const DEFAULT: Prefs = { autoScroll: false, autoScrollSpeed: 1, showChordDiagrams: true, songPreferences: {}, trackOverrides: {}, songTranspose: {}, preferredVersion: {}, splitView: {} };
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
  try {
    const raw = await readFile(join(userDir(dataDir, userId), FILE), "utf8");
    const parsed = JSON.parse(raw);
    return { ...DEFAULT, ...parsed };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { ...DEFAULT };
    throw err;
  }
}

export async function writePrefs(dataDir: string, userId: string, prefs: Prefs): Promise<void> {
  validateUserId(userId);
  const dir = userDir(dataDir, userId);
  await mkdir(dir, { recursive: true });
  const path = join(dir, FILE);
  const tmp = `${path}.tmp.${process.pid}`;
  await writeFile(tmp, JSON.stringify(prefs, null, 2), "utf8");
  await rename(tmp, path);
}
