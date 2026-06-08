import { getConfig } from "../config";
import { LibraryIndex } from "./index";
import { startLibraryWatcher } from "./watcher";
import { ensureMigrated } from "../auth/migrate";
import { logger } from "../logger";

let instance: LibraryIndex | null = null;
let stopWatcher: (() => Promise<void>) | null = null;
let bootstrap: Promise<void> | null = null;

export function getLibrary(): LibraryIndex {
  if (!instance) {
    const cfg = getConfig();
    instance = new LibraryIndex(cfg.libraryPath);
    bootstrap = ensureMigrated(cfg.dataPath, cfg.appSecret)
      .then(() => instance!.rescan())
      .then(() => {
        stopWatcher = startLibraryWatcher(instance!, cfg.libraryPath);
      })
      .catch((err) => {
        // Don't cache a permanently-rejected bootstrap (would wedge the app until
        // a full restart). Reset so the next access retries from scratch.
        logger.error({ err }, "library bootstrap failed; will retry on next access");
        instance = null;
        bootstrap = null;
        throw err;
      });
  }
  return instance;
}

export async function libraryReady(): Promise<void> {
  getLibrary();
  if (bootstrap) await bootstrap;
}
