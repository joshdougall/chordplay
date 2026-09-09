import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readPrefs, writePrefs } from "@/lib/prefs/store";
import { DEFAULT_PREFS, type Prefs } from "@/lib/prefs/defaults";
import { mergePrefs } from "@/lib/prefs/merge";

let dir: string;
const userId = "roundtrip-user";

beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), "cp-prefs-")); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

describe("mergePrefs", () => {
  it("keeps autoScrollSpeed, which the route used to discard", () => {
    const merged = mergePrefs({ autoScrollSpeed: 1.5 }, DEFAULT_PREFS);
    expect(merged.autoScrollSpeed).toBe(1.5);
  });

  it("keeps fontScale, which the route used to discard", () => {
    const merged = mergePrefs({ fontScale: 1.25 }, DEFAULT_PREFS);
    expect(merged.fontScale).toBe(1.25);
  });

  it("keeps chordStrip", () => {
    const merged = mergePrefs({ chordStrip: true }, DEFAULT_PREFS);
    expect(merged.chordStrip).toBe(true);
  });

  it("falls back to the current value for an absent field", () => {
    const current: Prefs = { ...DEFAULT_PREFS, autoScrollSpeed: 2, chordStrip: true };
    const merged = mergePrefs({ autoScroll: true }, current);
    expect(merged.autoScrollSpeed).toBe(2);
    expect(merged.chordStrip).toBe(true);
    expect(merged.autoScroll).toBe(true);
  });

  it("accepts an explicit false rather than treating it as absent", () => {
    const current: Prefs = { ...DEFAULT_PREFS, chordStrip: true };
    const merged = mergePrefs({ chordStrip: false }, current);
    expect(merged.chordStrip).toBe(false);
  });

  it("survives a write/read round trip through the store", async () => {
    const merged = mergePrefs(
      { chordStrip: true, autoScrollSpeed: 1.5, fontScale: 1.25 },
      DEFAULT_PREFS
    );
    await writePrefs(dir, userId, merged);
    const read = await readPrefs(dir, userId);
    expect(read.chordStrip).toBe(true);
    expect(read.autoScrollSpeed).toBe(1.5);
    expect(read.fontScale).toBe(1.25);
  });

  it("defaults chordStrip to false for a user who has never set it", async () => {
    const read = await readPrefs(dir, userId);
    expect(read.chordStrip).toBe(false);
  });
});
