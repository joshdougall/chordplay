import { describe, it, expect, vi } from "vitest";
import {
  toSlug,
  parseGuitarTabsMeta,
  parseGuitarTabsContent,
  findSongInArtistPage,
} from "@/lib/external/guitartabs";

// Silence logger output in tests
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── toSlug ───────────────────────────────────────────────────────────────────

describe("toSlug", () => {
  it("converts artist name to guitartabs slug (spaces -> underscores)", () => {
    expect(toSlug("Radiohead")).toBe("radiohead");
    expect(toSlug("Morgan Wallen")).toBe("morgan_wallen");
    expect(toSlug("AC/DC")).toBe("acdc");
    expect(toSlug("The Beatles")).toBe("the_beatles");
  });

  it("converts song title to slug", () => {
    expect(toSlug("Creep")).toBe("creep");
    expect(toSlug("One Thing At A Time")).toBe("one_thing_at_a_time");
    expect(toSlug("Don't Stop Me Now")).toBe("dont_stop_me_now");
  });

  it("handles hyphens as word separators", () => {
    expect(toSlug("well-known artist")).toBe("well_known_artist");
  });

  it("strips leading/trailing underscores", () => {
    expect(toSlug(" Radiohead ")).toBe("radiohead");
  });
});

// ── parseGuitarTabsMeta ──────────────────────────────────────────────────────

const FIXTURE_SONG_PAGE = `
<meta property="og:title" content="Radiohead - Creep Chords &amp; Tabs" />
<meta property="og:url" content="http://www.guitartabs.cc/tabs/r/radiohead/creep_crd.html" />
`;

const FIXTURE_ARTIST_TITLE = `
<meta property="og:title" content="The Beatles - Hey Jude Chords &amp; Tabs" />
`;

describe("parseGuitarTabsMeta", () => {
  it("extracts artist and title from og:title", () => {
    const meta = parseGuitarTabsMeta(FIXTURE_SONG_PAGE);
    expect(meta).not.toBeNull();
    expect(meta?.artist).toBe("Radiohead");
    expect(meta?.title).toBe("Creep");
  });

  it("handles multi-word artist and title", () => {
    const meta = parseGuitarTabsMeta(FIXTURE_ARTIST_TITLE);
    expect(meta).not.toBeNull();
    expect(meta?.artist).toBe("The Beatles");
    expect(meta?.title).toBe("Hey Jude");
  });

  it("returns null if og:title is missing", () => {
    expect(parseGuitarTabsMeta("<html></html>")).toBeNull();
  });

  it("returns null if og:title has no dash separator", () => {
    const html = `<meta property="og:title" content="No Separator Here" />`;
    expect(parseGuitarTabsMeta(html)).toBeNull();
  });
});

// ── parseGuitarTabsContent ───────────────────────────────────────────────────

const FIXTURE_PRE_CONTENT = `
<pre>Creep Chords</pre>
<pre>#----------------------------------PLEASE NOTE---------------------------------#
#This file is the author's own work.

Creep
=====
By Radiohead

                   G
When you were here before
                         B
Couldn't look you in the eyes
                 C
You look like an angel
                   Cm
Your skin makes me cry
</pre>
`;

describe("parseGuitarTabsContent", () => {
  it("extracts chord content from the second pre block", () => {
    const content = parseGuitarTabsContent(FIXTURE_PRE_CONTENT);
    expect(content).not.toBeNull();
    expect(content).toContain("When you were here before");
    expect(content).toContain("You look like an angel");
  });

  it("strips HTML tags", () => {
    const html = `<pre>first</pre><pre><b>G</b>\nLyrics</pre>`;
    const content = parseGuitarTabsContent(html);
    expect(content).not.toContain("<b>");
    expect(content).toContain("G");
    expect(content).toContain("Lyrics");
  });

  it("returns null with fewer than 2 pre blocks", () => {
    expect(parseGuitarTabsContent("<pre>only one</pre>")).toBeNull();
  });
});

// ── findSongInArtistPage ─────────────────────────────────────────────────────

const FIXTURE_ARTIST_PAGE = `
<tr>
  <td><a href="/tabs/r/radiohead/creep_crd.html">Creep Chords</a></td>
</tr>
<tr>
  <td><a href="/tabs/r/radiohead/creep_tab.html">Creep Tab</a></td>
</tr>
<tr>
  <td><a href="/tabs/r/radiohead/creep_crd_ver_2.html">Creep (ver 2) Chords</a></td>
</tr>
<tr>
  <td><a href="/tabs/r/radiohead/karma_police_crd.html">Karma Police Chords</a></td>
</tr>
`;

describe("findSongInArtistPage", () => {
  it("returns the chord page href for a matching song slug", () => {
    const href = findSongInArtistPage(FIXTURE_ARTIST_PAGE, "radiohead", "creep");
    expect(href).toBe("/tabs/r/radiohead/creep_crd.html");
  });

  it("returns null when song is not found", () => {
    expect(
      findSongInArtistPage(FIXTURE_ARTIST_PAGE, "radiohead", "fakesong")
    ).toBeNull();
  });

  it("finds songs with multi-word slugs", () => {
    const href = findSongInArtistPage(
      FIXTURE_ARTIST_PAGE,
      "radiohead",
      "karma_police"
    );
    expect(href).toBe("/tabs/r/radiohead/karma_police_crd.html");
  });
});
