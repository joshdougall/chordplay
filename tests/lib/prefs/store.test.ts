import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readPrefs, writePrefs } from "@/lib/prefs/store";

describe("prefs store", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "chordplay-prefs-")); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("returns defaults when file absent", async () => {
    const p = await readPrefs(dir);
    expect(p.autoScroll).toBe(false);
    expect(p.songPreferences).toEqual({});
    expect(p.trackOverrides).toEqual({});
  });

  it("writes and reads prefs", async () => {
    await writePrefs(dir, { autoScroll: true, songPreferences: { "id1": "tab" }, trackOverrides: { "t1": "id1" } });
    const p = await readPrefs(dir);
    expect(p.autoScroll).toBe(true);
    expect(p.songPreferences).toEqual({ "id1": "tab" });
  });
});
