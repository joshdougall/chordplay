import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readPrefs, writePrefs } from "@/lib/prefs/store";

describe("prefs store", () => {
  let dir: string;
  const userId = "testuser123";

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "chordplay-prefs-")); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("returns defaults when file absent", async () => {
    const p = await readPrefs(dir, userId);
    expect(p.autoScroll).toBe(false);
    expect(p.songPreferences).toEqual({});
    expect(p.trackOverrides).toEqual({});
  });

  it("writes and reads prefs", async () => {
    await writePrefs(dir, userId, { autoScroll: true, songPreferences: { "id1": "tab" }, trackOverrides: { "t1": "id1" }, songTranspose: {} });
    const p = await readPrefs(dir, userId);
    expect(p.autoScroll).toBe(true);
    expect(p.songPreferences).toEqual({ "id1": "tab" });
  });

  it("round-trips songTranspose", async () => {
    await writePrefs(dir, userId, { autoScroll: false, songPreferences: {}, trackOverrides: {}, songTranspose: { "song1": 3, "song2": -2 } });
    const p = await readPrefs(dir, userId);
    expect(p.songTranspose).toEqual({ "song1": 3, "song2": -2 });
  });

  it("returns empty songTranspose when field absent in file", async () => {
    const { writeFile, mkdir } = await import("node:fs/promises");
    const perUserDir = join(dir, "users", userId);
    await mkdir(perUserDir, { recursive: true });
    await writeFile(join(perUserDir, "prefs.json"), JSON.stringify({ autoScroll: false, songPreferences: {}, trackOverrides: {} }), "utf8");
    const p = await readPrefs(dir, userId);
    expect(p.songTranspose).toEqual({});
  });

  it("writes prefs under users/<userId>/prefs.json", async () => {
    await writePrefs(dir, userId, { autoScroll: false, songPreferences: {}, trackOverrides: {}, songTranspose: {} });
    expect(existsSync(join(dir, "users", userId, "prefs.json"))).toBe(true);
  });

  it("rejects invalid userId", async () => {
    await expect(readPrefs(dir, "../evil")).rejects.toThrow(/Invalid userId/);
    await expect(writePrefs(dir, "../evil", { autoScroll: false, songPreferences: {}, trackOverrides: {}, songTranspose: {} })).rejects.toThrow(/Invalid userId/);
  });

  it("two different users store prefs independently", async () => {
    await writePrefs(dir, "user1", { autoScroll: true, songPreferences: {}, trackOverrides: {}, songTranspose: {} });
    await writePrefs(dir, "user2", { autoScroll: false, songPreferences: {}, trackOverrides: {}, songTranspose: {} });
    const p1 = await readPrefs(dir, "user1");
    const p2 = await readPrefs(dir, "user2");
    expect(p1.autoScroll).toBe(true);
    expect(p2.autoScroll).toBe(false);
  });
});
