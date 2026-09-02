import chokidar from "chokidar";
import { relative } from "node:path";
import type { LibraryIndex } from "./index";
import { logger } from "@/lib/logger";

export function startLibraryWatcher(index: LibraryIndex, root: string): () => Promise<void> {
  const watcher = chokidar.watch(root, {
    ignoreInitial: true,
    ignored: /(^|[\\/])\../,
    persistent: true
  });

  const upsert = (path: string) => { void index.addOrUpdate(path); };
  const remove = (path: string) => { index.remove(relative(root, path)); };

  // FSWatcher is an EventEmitter: an "error" event with no listener THROWS and
  // takes the whole process down. fs.inotify.max_user_watches defaults to 8192
  // on a Pi, and chokidar emits ENOSPC on that path, so this is reachable.
  watcher.on("error", (err) => {
    logger.error({ err, root }, "library watcher error; index may go stale");
  });

  watcher.on("add", upsert);
  watcher.on("change", upsert);
  watcher.on("unlink", remove);

  return () => watcher.close();
}
