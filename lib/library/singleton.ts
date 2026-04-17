import { getConfig } from "../config";
import { LibraryIndex } from "./index";
import { startLibraryWatcher } from "./watcher";
import { ensureMigrated } from "../auth/migrate";

let instance: LibraryIndex | null = null;
let stopWatcher: (() => Promise<void>) | null = null;
let bootstrap: Promise<void> | null = null;

export function getLibrary(): LibraryIndex {
  if (!instance) {
    const cfg = getConfig();
    instance = new LibraryIndex(cfg.libraryPath);
    bootstrap = ensureMigrated(cfg.dataPath, cfg.appSecret).then(() =>
      instance!.rescan()
    ).then(() => {
      stopWatcher = startLibraryWatcher(instance!, cfg.libraryPath);
    });
  }
  return instance;
}

export async function libraryReady(): Promise<void> {
  getLibrary();
  if (bootstrap) await bootstrap;
}
