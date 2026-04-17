import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMetadata } from "@/lib/library/parser";
import { detectFormat } from "@/lib/library/format";

const __dirname = dirname(fileURLToPath(import.meta.url));
const F = (name: string) => join(__dirname, "fixtures", name);

describe("detectFormat", () => {
  it(".pro is chordpro", () => {
    expect(detectFormat("x.pro", "anything")).toBe("chordpro");
  });
  it(".gp is guitar-pro", () => {
    expect(detectFormat("x.gp", "")).toBe("guitar-pro");
  });
  it(".txt with tab lines is ascii-tab", () => {
    const content = readFileSync(F("ascii-tab.txt"), "utf8");
    expect(detectFormat("any.txt", content)).toBe("ascii-tab");
  });
  it(".txt without tab lines is chordpro (plain chord sheet)", () => {
    expect(detectFormat("any.txt", "just words")).toBe("chordpro");
  });
});

describe("parseMetadata", () => {
  it("reads chordpro directives", () => {
    const content = readFileSync(F("chord-sample.pro"), "utf8");
    const meta = parseMetadata("chord-sample.pro", content);
    expect(meta.title).toBe("Hey Jude");
    expect(meta.artist).toBe("The Beatles");
    expect(meta.spotifyTrackId).toBe("0aym2LBJBk9DAYuHHutrIl");
  });

  it("falls back to filename Artist - Title convention", () => {
    const content = readFileSync(F("Artist Name - Song Title.pro"), "utf8");
    const meta = parseMetadata("Artist Name - Song Title.pro", content);
    expect(meta.title).toBe("Song Title");
    expect(meta.artist).toBe("Artist Name");
    expect(meta.spotifyTrackId).toBeUndefined();
  });

  it("falls back to filename as title when no artist available", () => {
    const meta = parseMetadata("mystery.pro", "no directives");
    expect(meta.title).toBe("mystery");
    expect(meta.artist).toBe("");
  });
});
