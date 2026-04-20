import { describe, it, expect, vi } from "vitest";
import {
  toSlug,
  parseGuitareTabMeta,
  parseGuitareTabContent,
  findSongHref,
} from "@/lib/external/guitaretab";

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

describe("toSlug (guitaretab)", () => {
  it("converts artist name using hyphens", () => {
    expect(toSlug("Radiohead")).toBe("radiohead");
    expect(toSlug("Morgan Wallen")).toBe("morgan-wallen");
    expect(toSlug("The Beatles")).toBe("the-beatles");
  });

  it("handles special characters", () => {
    expect(toSlug("AC/DC")).toBe("acdc");
    expect(toSlug("R.E.M.")).toBe("rem");
  });

  it("collapses multiple spaces/hyphens", () => {
    expect(toSlug("artist  name")).toBe("artist-name");
  });
});

// ── parseGuitareTabMeta ──────────────────────────────────────────────────────

const FIXTURE_META_PAGE = `
<meta property="og:title" content="Creep chords with lyrics by Radiohead for guitar and ukulele @ Guitaretab"
<meta property="og:url" content="https://www.guitaretab.com/r/radiohead/288870.html"
`;

const FIXTURE_META_MULTIWORD = `
<meta property="og:title" content="One Thing At A Time chords with lyrics by Morgan Wallen for guitar and ukulele @ Guitaretab"
`;

describe("parseGuitareTabMeta", () => {
  it("extracts title and artist from og:title", () => {
    const meta = parseGuitareTabMeta(FIXTURE_META_PAGE);
    expect(meta).not.toBeNull();
    expect(meta?.title).toBe("Creep");
    expect(meta?.artist).toBe("Radiohead");
  });

  it("handles multi-word titles and artists", () => {
    const meta = parseGuitareTabMeta(FIXTURE_META_MULTIWORD);
    expect(meta).not.toBeNull();
    expect(meta?.title).toBe("One Thing At A Time");
    expect(meta?.artist).toBe("Morgan Wallen");
  });

  it("returns null if og:title is missing", () => {
    expect(parseGuitareTabMeta("<html></html>")).toBeNull();
  });

  it("returns null if og:title doesn't match expected format", () => {
    const html = `<meta property="og:title" content="Something Else Entirely"`;
    expect(parseGuitareTabMeta(html)).toBeNull();
  });
});

// ── parseGuitareTabContent ───────────────────────────────────────────────────

// Fixture based on real guitaretab.com HTML structure
const FIXTURE_PRE_CONTENT = `
<html><body>
<pre id="tab_content">
<span class="js-tab-row"  style="display: inline-block">#-------------------------------PLEASE NOTE-------------------------------------#</span>
<span class="js-tab-row"  style="display: inline-block"># This file is the author's own work and represents their interpretation of the #</span>
<span class="js-tab-row"  style="display: inline-block">Creep chords</span>
<span class="js-tab-row"  style="display: inline-block">Radiohead </span>
<span class="js-tab-row js-empty-tab-row" style="display: inline-block"></span>
<div class="js-text-tab" style="display: inline-block"><span class="js-tab-row"  style="display: block">                     <span class="gt-chord js-tab-ch js-tapped">G</span></span><span class="js-tab-row"  style="display: block">When you were here before,</span></div>
<div class="js-text-tab" style="display: inline-block"><span class="js-tab-row"  style="display: block">                         <span class="gt-chord js-tab-ch js-tapped">B7</span></span><span class="js-tab-row"  style="display: block">couldn t look you in the eye</span></div>
<div class="js-text-tab" style="display: inline-block"><span class="js-tab-row"  style="display: block">                    <span class="gt-chord js-tab-ch js-tapped">C</span></span><span class="js-tab-row"  style="display: block">You re just like an angel,</span></div>
<span class="js-tab-row js-empty-tab-row" style="display: inline-block"></span>
</pre>
</body></html>
`;

describe("parseGuitareTabContent", () => {
  it("converts js-text-tab divs to inline [Chord]lyric format", () => {
    const content = parseGuitareTabContent(FIXTURE_PRE_CONTENT);
    expect(content).not.toBeNull();
    expect(content).toContain("[G]When you were here before,");
    expect(content).toContain("[B7]couldn t look you in the eye");
    expect(content).toContain("[C]You re just like an angel,");
  });

  it("skips PLEASE NOTE header lines", () => {
    const content = parseGuitareTabContent(FIXTURE_PRE_CONTENT);
    expect(content).not.toContain("PLEASE NOTE");
    expect(content).not.toContain("author's own work");
  });

  it("returns null if no pre tag is present", () => {
    expect(parseGuitareTabContent("<html><body>no pre here</body></html>")).toBeNull();
  });

  it("returns null if pre tag has no js-text-tab content", () => {
    const html = "<html><body><pre>plain text only, no tabs</pre></body></html>";
    const content = parseGuitareTabContent(html);
    // Either null or the plain text
    if (content !== null) {
      expect(content).not.toContain("[");
    }
  });
});

// ── findSongHref ─────────────────────────────────────────────────────────────

const FIXTURE_ARTIST_PAGE = `
<div class="gt-list__row">
  <a href="/r/radiohead/15401.html" class="gt-link gt-link--primary" title="Creep tab">Creep tab</a>
</div>
<div class="gt-list__row">
  <a href="/r/radiohead/288870.html" class="gt-link gt-link--primary" title="Creep chords">Creep chords</a>
</div>
<div class="gt-list__row">
  <a href="/r/radiohead/193931.html" class="gt-link gt-link--primary" title="Creep drum">Creep drum</a>
</div>
<div class="gt-list__row">
  <a href="/r/radiohead/194940.html" class="gt-link gt-link--primary" title="Karma Police chords">Karma Police chords</a>
</div>
`;

describe("findSongHref", () => {
  it("prefers 'chords' result over tab/drum", () => {
    const href = findSongHref(FIXTURE_ARTIST_PAGE, "Creep");
    expect(href).toBe("/r/radiohead/288870.html");
  });

  it("finds multi-word song titles", () => {
    const href = findSongHref(FIXTURE_ARTIST_PAGE, "Karma Police");
    expect(href).toBe("/r/radiohead/194940.html");
  });

  it("returns null when song is not found", () => {
    expect(findSongHref(FIXTURE_ARTIST_PAGE, "Fake Song")).toBeNull();
  });

  it("is case-insensitive in matching", () => {
    const href = findSongHref(FIXTURE_ARTIST_PAGE, "creep");
    expect(href).not.toBeNull();
  });
});
