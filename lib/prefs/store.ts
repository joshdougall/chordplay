import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { join } from "node:path";

export type Prefs = {
  autoScroll: boolean;
  songPreferences: Record<string, "chords" | "tab">;
  trackOverrides: Record<string, string>;
};

const DEFAULT: Prefs = { autoScroll: false, songPreferences: {}, trackOverrides: {} };
const FILE = "prefs.json";

export async function readPrefs(dataDir: string): Promise<Prefs> {
  try {
    const raw = await readFile(join(dataDir, FILE), "utf8");
    const parsed = JSON.parse(raw);
    return { ...DEFAULT, ...parsed };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { ...DEFAULT };
    throw err;
  }
}

export async function writePrefs(dataDir: string, prefs: Prefs): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  const path = join(dataDir, FILE);
  const tmp = `${path}.tmp.${process.pid}`;
  await writeFile(tmp, JSON.stringify(prefs, null, 2), "utf8");
  await rename(tmp, path);
}
