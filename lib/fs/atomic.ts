import { open, rename, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";

export type AtomicWriteOptions = {
  /** File mode for the created file, e.g. 0o600 for secrets. */
  mode?: number;
};

/**
 * Write a file so readers only ever see complete content.
 *
 * The temp name carries a UUID, not just the pid. This process is a single Node
 * process, so `${path}.tmp.${process.pid}` is a constant — two concurrent writes
 * to the same target opened the *same* temp file with O_TRUNC and spliced their
 * output together, and whichever renamed second failed with ENOENT.
 *
 * Both the file and its parent directory are fsynced before returning, so a
 * power cut after this resolves cannot lose the write. This runs in a vehicle;
 * unclean shutdowns are routine rather than exceptional.
 */
export async function atomicWrite(
  path: string,
  content: string,
  options: AtomicWriteOptions = {}
): Promise<void> {
  const tmp = `${path}.tmp.${process.pid}.${randomUUID()}`;

  try {
    const handle = await open(tmp, "wx", options.mode);
    try {
      await handle.writeFile(content, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(tmp, path);
  } catch (err) {
    await unlink(tmp).catch(() => {});
    throw err;
  }

  await syncDir(dirname(path));
}

/**
 * Durably commit the directory entry created by the rename. Not every platform
 * or filesystem permits opening a directory, so a failure here is not fatal —
 * the data is already synced, only the entry's durability window is at stake.
 */
async function syncDir(dir: string): Promise<void> {
  let handle;
  try {
    handle = await open(dir, "r");
    await handle.sync();
  } catch {
    // best effort
  } finally {
    await handle?.close().catch(() => {});
  }
}
