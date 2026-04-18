import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { LibraryIndex } from "@/lib/library/index";
import { match } from "@/lib/library/matcher";
import fixtures from "./fixtures/matcher-cases.json";

type LibraryEntrySpec = {
  path: string;
  title: string;
  artist: string;
  spotifyTrackId?: string;
  versionName?: string;
  parseError?: boolean;
};

type Fixture = {
  name: string;
  library: LibraryEntrySpec[];
  input: { trackId: string; title: string; artists: string[] };
  prefs?: { trackOverrides?: Record<string, string> };
  expect: {
    match?: string | null;
    matchOneOf?: string[];
    confidence?: "exact" | "fuzzy";
    allMatches?: string[];
  };
  _comment?: string;
};

function buildFileContent(e: LibraryEntrySpec): string {
  let content = "";
  if (e.title) content += `{title: ${e.title}}\n`;
  if (e.artist) content += `{artist: ${e.artist}}\n`;
  if (e.spotifyTrackId) content += `{spotify_track_id: ${e.spotifyTrackId}}\n`;
  if (e.versionName) content += `{version: ${e.versionName}}\n`;
  content += "\n[C]placeholder\n";
  return content;
}

describe("matcher fixtures", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "chordplay-matcher-fixtures-"));
  });

  afterEach(() => {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  for (const fx of fixtures as Fixture[]) {
    it(fx.name, async () => {
      for (const e of fx.library) {
        const full = join(dir, e.path);
        mkdirSync(dirname(full), { recursive: true });
        if (e.parseError) {
          // Write a file that will survive the SUPPORTED extension check but fail to parse.
          // The parser falls back gracefully, so we write a content-free file and rely
          // on the fact that title+artist will be empty, leaving the entry effectively unmatched.
          writeFileSync(full, "");
          continue;
        }
        writeFileSync(full, buildFileContent(e));
      }

      const idx = new LibraryIndex(dir);
      await idx.rescan();

      const result = match(idx, fx.input, fx.prefs ?? {});

      if (fx.expect.match === null) {
        expect(result.match, `expected no match`).toBeNull();
      } else if (fx.expect.match !== undefined) {
        expect(result.match?.id, `expected match id`).toBe(fx.expect.match);
      } else if (fx.expect.matchOneOf !== undefined) {
        expect(result.match, `expected a match`).not.toBeNull();
        expect(fx.expect.matchOneOf, `expected match to be one of`).toContain(result.match?.id);
      }

      if (fx.expect.confidence !== undefined) {
        expect(result.confidence, `expected confidence`).toBe(fx.expect.confidence);
      }

      if (fx.expect.allMatches !== undefined) {
        const actualAll = (result.allMatches ?? []).map((e) => e.id).sort();
        expect(actualAll, `expected allMatches`).toEqual([...fx.expect.allMatches].sort());
      }
    });
  }
});
