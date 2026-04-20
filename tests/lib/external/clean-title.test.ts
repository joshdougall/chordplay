import { describe, it, expect } from "vitest";
import { cleanTitleForSearch, cleanArtistForSearch } from "@/lib/external/clean-title";

describe("cleanTitleForSearch", () => {
  it("strips Bonus Track", () => { expect(cleanTitleForSearch("Bloom - Bonus Track")).toBe("Bloom"); });
  it("strips Remastered YYYY", () => { expect(cleanTitleForSearch("Hey Jude - Remastered 2015")).toBe("Hey Jude"); });
  it("strips feat parenthetical", () => { expect(cleanTitleForSearch("Shallow (feat. Bradley Cooper)")).toBe("Shallow"); });
  it("strips Acoustic Version parenthetical", () => { expect(cleanTitleForSearch("Creep (Acoustic Version)")).toBe("Creep"); });
  it("strips Live suffix", () => { expect(cleanTitleForSearch("No Such Thing - Live at Fillmore")).toBe("No Such Thing"); });
  it("strips Remix", () => { expect(cleanTitleForSearch("Starboy - Remix")).toBe("Starboy"); });
  it("preserves title when no suffix", () => { expect(cleanTitleForSearch("Creep")).toBe("Creep"); });
  it("handles brackets", () => { expect(cleanTitleForSearch("Creep [Remastered]")).toBe("Creep"); });
  it("handles Deluxe Edition", () => { expect(cleanTitleForSearch("Hotel California - Deluxe Edition")).toBe("Hotel California"); });
});

describe("cleanArtistForSearch", () => {
  it("strips feat parenthetical", () => { expect(cleanArtistForSearch("Morgan Wallen (feat. Post Malone)")).toBe("Morgan Wallen"); });
  it("strips feat suffix", () => { expect(cleanArtistForSearch("Ed Sheeran feat. Justin Bieber")).toBe("Ed Sheeran"); });
  it("takes first of comma list", () => { expect(cleanArtistForSearch("Jay-Z, Kanye West")).toBe("Jay-Z"); });
  it("preserves single artist", () => { expect(cleanArtistForSearch("Radiohead")).toBe("Radiohead"); });
});
