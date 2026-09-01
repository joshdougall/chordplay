import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { readPrefs, writePrefs } from "@/lib/prefs/store";
import { readTokens, writeTokens } from "@/lib/auth/tokens";
import { readUserChordDb } from "@/lib/chord-diagrams/user-chord-db";

/**
 * A half-written file must degrade to "absent", never throw.
 *
 * Before this, only ENOENT was handled, so a SyntaxError propagated:
 * GET /api/prefs 500s, the page's fetch has no .catch, prefs stays null
 * forever, and every guard short-circuits — transpose, auto-scroll, split
 * view and version selection all become silent no-ops. PUT /api/prefs reads
 * before it writes, so the user cannot overwrite the bad file from the UI.
 * Recovery required SSH to the Pi.
 */

let dir: string;
const USER = "joshdougall";

async function userFile(name: string, contents: string): Promise<void> {
  const d = join(dir, "users", USER);
  await mkdir(d, { recursive: true });
  await writeFile(join(d, name), contents, "utf8");
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "chordplay-corrupt-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("readPrefs", () => {
  it("falls back to defaults when prefs.json is truncated mid-write", async () => {
    await userFile("prefs.json", '{"autoScroll": true, "songTran');
    await expect(readPrefs(dir, USER)).resolves.toMatchObject({ autoScroll: false });
  });

  it("falls back to defaults when prefs.json holds two spliced writes", async () => {
    await userFile("prefs.json", '{"autoScroll": true}{"autoScroll": false}');
    await expect(readPrefs(dir, USER)).resolves.toMatchObject({ autoScroll: false });
  });

  it("falls back to defaults when prefs.json is empty", async () => {
    await userFile("prefs.json", "");
    await expect(readPrefs(dir, USER)).resolves.toMatchObject({ autoScroll: false });
  });

  it("lets the user overwrite a corrupt file from the UI", async () => {
    await userFile("prefs.json", "{{{ not json");
    const current = await readPrefs(dir, USER);
    await writePrefs(dir, USER, { ...current, autoScroll: true });
    await expect(readPrefs(dir, USER)).resolves.toMatchObject({ autoScroll: true });
  });

  it("still returns real prefs when the file is valid", async () => {
    await writePrefs(dir, USER, {
      autoScroll: true, autoScrollSpeed: 2, showChordDiagrams: false,
      songPreferences: {}, trackOverrides: {}, songTranspose: { a: 3 },
      preferredVersion: {}, splitView: {}
    });
    await expect(readPrefs(dir, USER)).resolves.toMatchObject({
      autoScroll: true, autoScrollSpeed: 2, songTranspose: { a: 3 }
    });
  });

  it("still throws on an unexpected I/O error", async () => {
    // A directory where the file should be: EISDIR, not a parse failure.
    await mkdir(join(dir, "users", USER, "prefs.json"), { recursive: true });
    await expect(readPrefs(dir, USER)).rejects.toThrow();
  });
});

describe("readTokens", () => {
  it("returns null when tokens.json is corrupt", async () => {
    await userFile("tokens.json", '{"blob": "abc');
    await expect(readTokens(dir, randomBytes(32), USER)).resolves.toBeNull();
  });

  it("returns null when the blob cannot be decrypted with this key", async () => {
    await writeTokens(dir, randomBytes(32), USER, {
      refreshToken: "rt", scopes: [], issuedAt: 1
    });
    // Different key: functionally the same as having no token — prompt a reconnect.
    await expect(readTokens(dir, randomBytes(32), USER)).resolves.toBeNull();
  });

  it("still round-trips a valid token", async () => {
    const key = randomBytes(32);
    await writeTokens(dir, key, USER, { refreshToken: "rt-1", scopes: ["s"], issuedAt: 7 });
    await expect(readTokens(dir, key, USER)).resolves.toMatchObject({ refreshToken: "rt-1" });
  });
});

describe("readUserChordDb", () => {
  it("returns an empty db when the file is corrupt", async () => {
    await userFile("user-chord-db.json", "]not json[");
    await expect(readUserChordDb(dir, USER)).resolves.toEqual({});
  });
});
