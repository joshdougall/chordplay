import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { writePrefs, readPrefs, type Prefs } from "@/lib/prefs/store";
import { writeTokens, readTokens } from "@/lib/auth/tokens";
import { writeEntry } from "@/lib/library/editor";
import { writeUserChordDb, readUserChordDb } from "@/lib/chord-diagrams/user-chord-db";

/**
 * Every one of these races is reachable in production:
 *  - prefs:    two transposes inside one round-trip, or a phone and tablet both open
 *  - tokens:   the refresh storm when an access token expires with several polls in flight
 *  - library:  two people playing the same song, each firing POST .../spotify-track
 *              against the one SHARED library file
 *  - chord db: two diagram edits saved in quick succession
 */

let dir: string;
const USER = "joshdougall";

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "chordplay-concurrent-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function prefsWith(n: number): Prefs {
  return {
    autoScroll: true,
    autoScrollSpeed: 1,
    showChordDiagrams: true,
    songPreferences: {},
    trackOverrides: {},
    // Enough bulk that an interleaved write splices visibly rather than by luck.
    songTranspose: Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`song-${i}`, n])),
    preferredVersion: {},
    splitView: {}
  };
}

describe("concurrent writes leave readable files", () => {
  it("writePrefs: 12 racing writers all resolve and prefs stay parseable", async () => {
    const settled = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) => writePrefs(dir, USER, prefsWith(i)))
    );

    expect(settled.filter((s) => s.status === "rejected")).toEqual([]);
    await expect(readPrefs(dir, USER)).resolves.toMatchObject({ autoScroll: true });
  });

  it("writeTokens: racing refreshes never corrupt the credential file", async () => {
    const key = randomBytes(32);
    const settled = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) =>
        writeTokens(dir, key, USER, {
          refreshToken: `refresh-token-${i}-${"z".repeat(500)}`,
          scopes: ["user-read-playback-state"],
          issuedAt: 1_700_000_000_000 + i
        })
      )
    );

    expect(settled.filter((s) => s.status === "rejected")).toEqual([]);
    const tokens = await readTokens(dir, key, USER);
    expect(tokens?.refreshToken).toMatch(/^refresh-token-\d+-z+$/);
  });

  it("writeEntry: racing writers to one shared chord sheet never splice content", async () => {
    const settled = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) =>
        writeEntry(dir, "shared/song.pro", `{title: Take ${i}}\n${"[C]lyric line\n".repeat(200)}`)
      )
    );

    expect(settled.filter((s) => s.status === "rejected")).toEqual([]);
    const content = await readFile(join(dir, "shared/song.pro"), "utf8");
    expect(content).toMatch(/^\{title: Take \d+\}\n/);
    expect(content.match(/\{title:/g)).toHaveLength(1);
  });

  it("writeUserChordDb: racing diagram saves stay parseable", async () => {
    const settled = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) => writeUserChordDb(dir, USER, { [`C${i}`]: { frets: [i] } } as never))
    );

    expect(settled.filter((s) => s.status === "rejected")).toEqual([]);
    await expect(readUserChordDb(dir, USER)).resolves.toBeTypeOf("object");
  });

  it("leaves no .tmp files anywhere under the data dir", async () => {
    await Promise.allSettled([
      ...Array.from({ length: 8 }, (_, i) => writePrefs(dir, USER, prefsWith(i))),
      ...Array.from({ length: 8 }, (_, i) => writeUserChordDb(dir, USER, { [`C${i}`]: {} } as never))
    ]);

    const userDir = join(dir, "users", USER);
    const leftovers = (await readdir(userDir)).filter((f) => f.includes(".tmp."));
    expect(leftovers).toEqual([]);
  });
});
