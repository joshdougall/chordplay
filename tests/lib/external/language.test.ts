import { describe, it, expect, vi } from "vitest";
import { extractLyrics, isAcceptableLanguage } from "@/lib/external/language";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

describe("extractLyrics", () => {
  it("strips chord markers and directives", () => {
    const out = extractLyrics("{title: X}\n{artist: Y}\n\n[C]Hello [G]world, how are you today");
    expect(out).toBe("Hello world, how are you today");
  });
});

describe("isAcceptableLanguage", () => {
  it("accepts English content", () => {
    const c = "[C]When you came [G]in, the air went [Am]out, and every [F]shadow filled up with doubt";
    expect(isAcceptableLanguage(c)).toBe(true);
  });
  it("rejects Norwegian content", () => {
    // Real Norwegian ballad about Morgan Kane (the false match case)
    const c = `Morgan Kane var hans navn
Mange drapsmenn ville prøve dette ry
Gribber samlet seg ved kalde morgengry
Tause satt de der og voktet dødens spill
Ved solnedgang lød klang av spader fra Boot Hill`;
    expect(isAcceptableLanguage(c, { providerId: "test", artist: "HARDY", title: "Red" })).toBe(false);
  });
  it("accepts Spanish (cover-friendly)", () => {
    const c = "[C]Hola [G]mundo como estas hoy yo te quiero mucho [Am]más que nunca cada día que pasa";
    expect(isAcceptableLanguage(c)).toBe(true);
  });
  it("passes through very short content", () => {
    expect(isAcceptableLanguage("[C]yo")).toBe(true);
  });
});
