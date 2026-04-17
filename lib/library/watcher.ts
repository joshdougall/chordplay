import chokidar from "chokidar";
import { relative } from "node:path";
import type { LibraryIndex } from "./index";

export function startLibraryWatcher(index: LibraryIndex, root: string): () => Promise<void> {
  const watcher = chokidar.watch(root, {
    ignoreInitial: true,
    ignored: /(^|[\\/])\../,
    persistent: true
  });

  const upsert = (path: string) => { void index.addOrUpdate(path); };
  const remove = (path: string) => { index.remove(relative(root, path)); };

  watcher.on("add", upsert);
  watcher.on("change", upsert);
  watcher.on("unlink", remove);

  return () => watcher.close();
}
