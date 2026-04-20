import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readUserChordDb, writeUserChordDb } from "@/lib/chord-diagrams/user-chord-db";
import type { UserChordDb } from "@/lib/chord-diagrams/user-chord-db";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "chordplay-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("readUserChordDb", () => {
  it("returns empty object when file does not exist", async () => {
    const result = await readUserChordDb(tmpDir, "testuser");
    expect(result).toEqual({});
  });

  it("reads back a written DB", async () => {
    const db: UserChordDb = {
      C: { fingers: [[6, "x"], [5, 3], [4, 2], [3, 0], [2, 1], [1, 0]], barres: [] },
    };
    await writeUserChordDb(tmpDir, "testuser", db);
    const result = await readUserChordDb(tmpDir, "testuser");
    expect(result).toEqual(db);
  });

  it("rejects invalid userId", async () => {
    await expect(readUserChordDb(tmpDir, "bad/user")).rejects.toThrow("Invalid userId");
  });
});

describe("writeUserChordDb", () => {
  it("creates parent directories as needed", async () => {
    const db: UserChordDb = {
      Am: { fingers: [[6, "x"], [5, 0], [4, 2], [3, 2], [2, 1], [1, 0]], barres: [] },
    };
    await writeUserChordDb(tmpDir, "newuser", db);
    const result = await readUserChordDb(tmpDir, "newuser");
    expect(result).toEqual(db);
  });

  it("round-trips complex chords with barres and position", async () => {
    const db: UserChordDb = {
      Bm: {
        fingers: [[4, 4], [3, 4], [2, 3]],
        barres: [{ fromString: 5, toString: 1, fret: 2 }],
      },
      Cm: {
        fingers: [[5, 3], [4, 5], [3, 5]],
        barres: [{ fromString: 6, toString: 1, fret: 3 }],
        position: 3,
      },
    };
    await writeUserChordDb(tmpDir, "testuser", db);
    const result = await readUserChordDb(tmpDir, "testuser");
    expect(result).toEqual(db);
  });

  it("overwrites an existing DB atomically", async () => {
    const db1: UserChordDb = { G: { fingers: [[6, 3]], barres: [] } };
    const db2: UserChordDb = { G: { fingers: [[6, 2]], barres: [] }, D: { fingers: [[4, 0]], barres: [] } };
    await writeUserChordDb(tmpDir, "testuser", db1);
    await writeUserChordDb(tmpDir, "testuser", db2);
    const result = await readUserChordDb(tmpDir, "testuser");
    expect(result).toEqual(db2);
  });

  it("rejects invalid userId", async () => {
    await expect(writeUserChordDb(tmpDir, "bad user", {})).rejects.toThrow("Invalid userId");
  });
});
