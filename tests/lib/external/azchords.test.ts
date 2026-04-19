import { describe, it, expect, vi } from "vitest";
import {
  artistSlug,
  songSlug,
  parseArtistEntries,
  parseSongEntries,
  findBestSong,
  parseAzChordsMetadata,
  parseAzChordsContent,
} from "@/lib/external/azchords";

// Silence logger output in tests
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── slug helpers ─────────────────────────────────────────────────────────────

describe("artistSlug", () => {
  it("lowercases and removes all non-alphanumeric chars", () => {
    expect(artistSlug("Radiohead")).toBe("radiohead");
    expect(artistSlug("Morgan Wallen")).toBe("morganwallen");
    expect(artistSlug("R.E.M.")).toBe("rem");
    expect(artistSlug("AC/DC")).toBe("acdc");
  });
});

describe("songSlug", () => {
  it("lowercases and removes non-alphanumeric chars", () => {
    expect(songSlug("Creep")).toBe("creep");
    expect(songSlug("One Thing At A Time")).toBe("onethingatatime");
    expect(songSlug("Can't Stop (Won't Stop)")).toBe("cantstopwontstop");
  });
});

// ── parseArtistEntries ───────────────────────────────────────────────────────

const FIXTURE_LETTER_PAGE = `
<div>
  <a href="/r/radiodriveby-chords-58646.html">Radiodriveby</a>
</div>
<div>
  <a href="/r/radiohead-tabs-3178.html">Radiohead</a>
</div>
<div>
  <a href="/r/radioshhit-tabs-53907.html">Radioshhit</a>
</div>
`;

describe("parseArtistEntries", () => {
  it("parses artist entries from the letter page", () => {
    const entries = parseArtistEntries(FIXTURE_LETTER_PAGE);
    expect(entries.length).toBeGreaterThanOrEqual(3);
    const rh = entries.find((e) => e.slug === "radiohead");
    expect(rh).toBeDefined();
    expect(rh?.id).toBe("3178");
    expect(rh?.href).toBe("/r/radiohead-tabs-3178.html");
  });

  it("returns empty array for page with no artist links", () => {
    const entries = parseArtistEntries("<html><body>nothing</body></html>");
    expect(entries).toHaveLength(0);
  });
});

// ── parseSongEntries ─────────────────────────────────────────────────────────

const FIXTURE_SONG_LIST = `
<a href="/r/radiohead-tabs-3178/creep-tabs-897462.html">Version 1</a>
<a href="/r/radiohead-tabs-3178/creep-tabs-929065.html">Version 2</a>
<a href="/r/radiohead-tabs-3178/karmapolice-tabs-194940.html">Karma Police</a>
`;

describe("parseSongEntries", () => {
  it("extracts song entry URLs from artist chords listing", () => {
    const entries = parseSongEntries(FIXTURE_SONG_LIST);
    expect(entries.length).toBeGreaterThanOrEqual(3);
    const hrefs = entries.map((e) => e.url);
    expect(hrefs).toContain(
      "/r/radiohead-tabs-3178/creep-tabs-897462.html"
    );
    expect(hrefs).toContain(
      "/r/radiohead-tabs-3178/karmapolice-tabs-194940.html"
    );
  });

  it("de-duplicates entries from dropdown markup", () => {
    // Duplicate of same href from dropdown render
    const dup = FIXTURE_SONG_LIST + FIXTURE_SONG_LIST;
    const entries = parseSongEntries(dup);
    const hrefs = entries.map((e) => e.url);
    const unique = new Set(hrefs);
    expect(hrefs.length).toBe(unique.size);
  });
});

// ── findBestSong ─────────────────────────────────────────────────────────────

const SONG_ENTRIES = [
  { title: "karmapolice-tabs-194940.html", url: "/r/radiohead-tabs-3178/karmapolice-tabs-194940.html" },
  { title: "creep-tabs-897462.html", url: "/r/radiohead-tabs-3178/creep-tabs-897462.html" },
  { title: "creep-tabs-929065.html", url: "/r/radiohead-tabs-3178/creep-tabs-929065.html" },
];

describe("findBestSong", () => {
  it("returns the first matching song URL", () => {
    const url = findBestSong(SONG_ENTRIES, "creep");
    expect(url).toBe("/r/radiohead-tabs-3178/creep-tabs-897462.html");
  });

  it("returns null when no match found", () => {
    expect(findBestSong(SONG_ENTRIES, "fakesongtitle")).toBeNull();
  });

  it("matches karma police by slug", () => {
    const url = findBestSong(SONG_ENTRIES, "karmapolice");
    expect(url).toBe("/r/radiohead-tabs-3178/karmapolice-tabs-194940.html");
  });
});

// ── parseAzChordsMetadata ────────────────────────────────────────────────────

const FIXTURE_SONG_PAGE = `
<meta property="og:title" content="Creep Chords – Radiohead | Version #1"
<meta property="og:url" content="https://www.azchords.com/r/radiohead-tabs-3178/creep-tabs-897462.html"
`;

const FIXTURE_SONG_PAGE_EMDASH = `
<meta property="og:title" content="Hey Jude Chords — The Beatles | Version #2"
`;

describe("parseAzChordsMetadata", () => {
  it("extracts title and artist from og:title with en-dash", () => {
    const meta = parseAzChordsMetadata(FIXTURE_SONG_PAGE);
    expect(meta).not.toBeNull();
    expect(meta?.title).toBe("Creep");
    expect(meta?.artist).toBe("Radiohead");
  });

  it("extracts title and artist from og:title with em-dash", () => {
    const meta = parseAzChordsMetadata(FIXTURE_SONG_PAGE_EMDASH);
    expect(meta).not.toBeNull();
    expect(meta?.title).toBe("Hey Jude");
    expect(meta?.artist).toBe("The Beatles");
  });

  it("returns null for page without og:title", () => {
    expect(parseAzChordsMetadata("<html></html>")).toBeNull();
  });
});

// ── parseAzChordsContent ─────────────────────────────────────────────────────

const FIXTURE_CHORD_PAGE = `
<pre>
  Tabs too difficult? Try these video lessons and learn fast
</pre>
<pre>

[Intro]
G B C Cm

[Verse 1]
                     G                              B
When you were here before, couldn't look you in the eyes
                    C                         Cm
You're just like an angel, your skin makes me cry

</pre>
<pre>Submit corrections</pre>
<pre>Hard to play? Try these video lessons and learn fast</pre>
`;

describe("parseAzChordsContent", () => {
  it("extracts the second pre block as chord content", () => {
    const content = parseAzChordsContent(FIXTURE_CHORD_PAGE);
    expect(content).not.toBeNull();
    expect(content).toContain("[Intro]");
    expect(content).toContain("[Verse 1]");
    expect(content).toContain("When you were here before");
  });

  it("strips HTML tags from content", () => {
    const html = `<pre>ad</pre><pre><b>G</b> <em>D</em>\nLyrics here</pre>`;
    const content = parseAzChordsContent(html);
    expect(content).not.toContain("<b>");
    expect(content).not.toContain("<em>");
    expect(content).toContain("G");
    expect(content).toContain("Lyrics here");
  });

  it("returns null when fewer than 2 pre blocks", () => {
    const content = parseAzChordsContent("<pre>Only one pre</pre>");
    expect(content).toBeNull();
  });
});
