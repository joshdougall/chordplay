import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ugContentToChordPro,
  searchTabs,
  getTab,
  fetchUGApiChords,
  UG_API_ID,
  UG_API_NAME,
} from "@/lib/external/ultimate-guitar-api";

// ---------------------------------------------------------------------------
// ugContentToChordPro — pure function, no mocks needed
// ---------------------------------------------------------------------------

describe("ugContentToChordPro", () => {
  it("converts [ch]C[/ch] to [C]", () => {
    expect(ugContentToChordPro("[ch]C[/ch]")).toBe("[C]");
  });

  it("converts multiple chord tags in one line", () => {
    expect(ugContentToChordPro("[ch]G[/ch] some words [ch]Am[/ch]")).toBe(
      "[G] some words [Am]"
    );
  });

  it("converts complex chord names", () => {
    expect(ugContentToChordPro("[ch]D/F#[/ch] [ch]Cmaj7[/ch]")).toBe(
      "[D/F#] [Cmaj7]"
    );
  });

  it("strips [tab] and [/tab] wrappers", () => {
    expect(ugContentToChordPro("[tab]some content[/tab]")).toBe("some content");
  });

  it("converts chord tags inside [tab] blocks", () => {
    const input = "[tab][ch]G[/ch] lyrics[/tab]";
    expect(ugContentToChordPro(input)).toBe("[G] lyrics");
  });

  it("trims leading and trailing whitespace", () => {
    expect(ugContentToChordPro("  [ch]C[/ch]  ")).toBe("[C]");
  });

  it("preserves multi-line content", () => {
    const input = "[ch]G[/ch] Verse line\n[ch]D[/ch] Another line";
    const result = ugContentToChordPro(input);
    expect(result).toContain("[G] Verse line");
    expect(result).toContain("[D] Another line");
  });

  it("passes through section markers unchanged", () => {
    const input = "[Verse 1]\n[ch]Am[/ch] lyrics";
    const result = ugContentToChordPro(input);
    expect(result).toContain("[Verse 1]");
    expect(result).toContain("[Am] lyrics");
  });

  it("returns empty string for empty input", () => {
    expect(ugContentToChordPro("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Fixtures for HTTP-mocked tests
// ---------------------------------------------------------------------------

const SEARCH_FIXTURE = {
  tabs: [
    {
      id: 4169,
      song_name: "Creep",
      artist_name: "Radiohead",
      type: "Chords",
      rating: 4.87,
    },
    {
      id: 51053,
      song_name: "Creep",
      artist_name: "Radiohead",
      type: "Chords",
      rating: 4.84,
    },
    // Non-chords result — should be filtered out
    {
      id: 99999,
      song_name: "Creep",
      artist_name: "Radiohead",
      type: "Tab",
      rating: 4.99,
    },
  ],
  artists: ["Radiohead"],
};

const TAB_INFO_FIXTURE = {
  id: 4169,
  song_name: "Creep",
  artist_name: "Radiohead",
  type: "Chords",
  rating: 4.87,
  content:
    "[Intro]\n[ch]G[/ch] [ch]B[/ch] [ch]C[/ch] [ch]Cm[/ch]\n\n[Verse]\n[tab][ch]G[/ch] When you were here before[/tab]",
  url_web: "https://tabs.ultimate-guitar.com/tab/radiohead/creep-chords-4169",
};

// ---------------------------------------------------------------------------
// searchTabs — mocks fetch
// ---------------------------------------------------------------------------

describe("searchTabs", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns only Chords-type tabs from the response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => SEARCH_FIXTURE,
      })
    );

    const results = await searchTabs("Radiohead", "Creep");
    expect(results).toHaveLength(2); // Tab type filtered out
    for (const t of results) {
      expect(t.type).toBe("Chords");
    }
  });

  it("returns empty array when tabs array is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ artists: [] }),
      })
    );

    const results = await searchTabs("Nobody", "NoSong");
    expect(results).toEqual([]);
  });

  it("throws on non-200 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({}),
      })
    );

    await expect(searchTabs("X", "Y")).rejects.toThrow("UG search HTTP 403");
  });

  it("calls the correct search URL with type[]=300", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tabs: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await searchTabs("Radiohead", "Creep");

    const [url] = mockFetch.mock.calls[0] as [string, ...unknown[]];
    expect(url).toContain("/tab/search");
    expect(url).toContain("type[]=300");
    expect(url).toContain("Radiohead");
    expect(url).toContain("Creep");
  });
});

// ---------------------------------------------------------------------------
// getTab — mocks fetch
// ---------------------------------------------------------------------------

describe("getTab", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns tab info from the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => TAB_INFO_FIXTURE,
      })
    );

    const info = await getTab(4169);
    expect(info.song_name).toBe("Creep");
    expect(info.artist_name).toBe("Radiohead");
    expect(info.content).toContain("[ch]G[/ch]");
  });

  it("throws on non-200 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      })
    );

    await expect(getTab(0)).rejects.toThrow("UG tab/info HTTP 404");
  });

  it("calls the correct tab/info URL", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => TAB_INFO_FIXTURE,
    });
    vi.stubGlobal("fetch", mockFetch);

    await getTab(4169);

    const [url] = mockFetch.mock.calls[0] as [string, ...unknown[]];
    expect(url).toContain("/tab/info");
    expect(url).toContain("tab_id=4169");
  });
});

// ---------------------------------------------------------------------------
// fetchUGApiChords — integration of search + info + conversion
// ---------------------------------------------------------------------------

describe("fetchUGApiChords", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function mockTwoStepFetch() {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: async () => SEARCH_FIXTURE,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => TAB_INFO_FIXTURE,
        });
      })
    );
  }

  it("returns ExternalChords with converted content", async () => {
    mockTwoStepFetch();

    const result = await fetchUGApiChords("Radiohead", "Creep");
    expect(result).not.toBeNull();
    expect(result!.source).toBe(UG_API_ID);
    expect(result!.sourceName).toBe(UG_API_NAME);
    expect(result!.title).toBe("Creep");
    expect(result!.artist).toBe("Radiohead");
    expect(result!.content).toContain("{title: Creep}");
    expect(result!.content).toContain("{artist: Radiohead}");
  });

  it("content has [ch] tags converted to ChordPro brackets", async () => {
    mockTwoStepFetch();

    const result = await fetchUGApiChords("Radiohead", "Creep");
    expect(result).not.toBeNull();
    // No raw UG markers should remain
    expect(result!.content).not.toContain("[ch]");
    expect(result!.content).not.toContain("[/ch]");
    expect(result!.content).not.toContain("[tab]");
    // Converted chords should be present
    expect(result!.content).toContain("[G]");
    expect(result!.content).toContain("[Cm]");
  });

  it("picks highest-rated tab when multiple are returned", async () => {
    // Both search results have same song; fixture has 4169 at 4.87, 51053 at 4.84
    // So getTab should be called with 4169
    const mockFetch = vi.fn();
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => SEARCH_FIXTURE })
      .mockResolvedValueOnce({ ok: true, json: async () => TAB_INFO_FIXTURE });
    vi.stubGlobal("fetch", mockFetch);

    await fetchUGApiChords("Radiohead", "Creep");

    // Second call (tab/info) should have tab_id=4169
    const [infoUrl] = mockFetch.mock.calls[1] as [string, ...unknown[]];
    expect(infoUrl).toContain("tab_id=4169");
  });

  it("returns null when search returns no Chords results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ tabs: [] }),
      })
    );

    const result = await fetchUGApiChords("Unknown", "NoSong");
    expect(result).toBeNull();
  });

  it("returns null when tab content is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => SEARCH_FIXTURE })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...TAB_INFO_FIXTURE, content: "" }),
        })
    );

    const result = await fetchUGApiChords("Radiohead", "Creep");
    expect(result).toBeNull();
  });

  it("returns null and does not throw when search HTTP fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 })
    );

    const result = await fetchUGApiChords("Radiohead", "Creep");
    expect(result).toBeNull();
  });

  it("returns null and does not throw when tab/info HTTP fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => SEARCH_FIXTURE })
        .mockResolvedValueOnce({ ok: false, status: 403 })
    );

    const result = await fetchUGApiChords("Radiohead", "Creep");
    expect(result).toBeNull();
  });

  it("includes rating from tab info in result", async () => {
    mockTwoStepFetch();

    const result = await fetchUGApiChords("Radiohead", "Creep");
    expect(result!.rating).toBeCloseTo(4.87, 1);
  });
});
