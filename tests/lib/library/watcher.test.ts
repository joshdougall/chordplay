import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LibraryIndex } from "@/lib/library/index";
import { startLibraryWatcher } from "@/lib/library/watcher";

function wait(ms: number) { return new Promise(r => setTimeout(r, ms)); }

describe("library watcher", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "chordplay-watch-")); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("picks up file additions and removals", async () => {
    const idx = new LibraryIndex(dir);
    await idx.rescan();
    const stop = startLibraryWatcher(idx, dir);
    await wait(200);
    writeFileSync(join(dir, "a.pro"), "{title: A}\n{artist: B}");
    await wait(1000);
    expect(idx.all().map(e => e.title)).toContain("A");
    unlinkSync(join(dir, "a.pro"));
    await wait(1000);
    expect(idx.all().map(e => e.title)).not.toContain("A");
    await stop();
  });
}, { timeout: 10000 });
