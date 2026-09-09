import { test, expect, type Page } from "@playwright/test";
import { seedAuthentication, setSessionCookie, FAKE_USER_ID } from "./helpers/session";
import { resetLibrary, seedSheet } from "./helpers/library";

const SHEET_ID = "chord-strip-test.pro";
const TRACK_ID = "trk-strip-1";
const DURATION_MS = 200_000;

// A positional sheet: chords on their own line above the words, which is how 44
// of the library's 47 sheets are written and the case the old row map missed.
const SHEET_CONTENT = [
  "{title: Strip Test}",
  "{artist: E2E Band}",
  `{spotify_track_id: ${TRACK_ID}}`,
  "",
  "[C]        [G]",
  "When I find myself in times",
  "[Am]       [F]",
  "Mother Mary comes to me",
  "[C]        [G]",
  "Speaking words of wisdom",
  "[Am]       [F]",
  "Let it be, let it be",
].join("\n");

const ENTRY = {
  id: SHEET_ID,
  title: "Strip Test",
  artist: "E2E Band",
  format: "chordpro",
  spotifyTrackId: TRACK_ID,
  parseError: false,
  songKey: "e2e-band||strip-test",
};

/** Mutable so a test can advance playback between reloads. */
let progressMs = 0;
let chordStrip = true;

function mockRoutes(page: Page) {
  page.route("**/api/auth/status", route =>
    route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ authenticated: true, userId: FAKE_USER_ID }),
    })
  );
  page.route("**/api/now-playing", route =>
    route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        trackId: TRACK_ID, title: "Strip Test", artists: ["E2E Band"],
        albumArt: null, progressMs, durationMs: DURATION_MS, isPlaying: true,
      }),
    })
  );
  page.route("**/api/library/match**", route =>
    route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ match: ENTRY, confidence: "exact", allMatches: [ENTRY] }),
    })
  );
  page.route(`**/api/library/${encodeURIComponent(SHEET_ID)}`, route => {
    if (route.request().method() === "POST") return route.continue();
    return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ entry: ENTRY, content: SHEET_CONTENT }),
    });
  });
  page.route("**/api/spotify/recently-played", route =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ tracks: [] }) })
  );
  page.route("**/api/prefs", route => {
    if (route.request().method() === "PUT") return route.continue();
    return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        autoScroll: false, autoScrollSpeed: 1, showChordDiagrams: true,
        songPreferences: {}, trackOverrides: {}, songTranspose: {},
        preferredVersion: {}, splitView: {}, fontScale: 1, chordStrip,
      }),
    });
  });
}

test.describe("Chord strip", () => {
  test.beforeEach(async ({ context, page }) => {
    resetLibrary();
    seedSheet(SHEET_ID, SHEET_CONTENT);
    await seedAuthentication();
    await setSessionCookie(context);
    progressMs = 0;
    chordStrip = true;
    mockRoutes(page);
  });

  test("shows the strip with the pref on and hides it with the pref off", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".chord-strip")).toBeVisible();

    chordStrip = false;
    await page.reload();
    await expect(page.locator(".chord-strip")).toHaveCount(0);
  });

  test("renders the sheet's chords in order", async ({ page }) => {
    await page.goto("/");
    const cues = page.locator(".chord-strip-cue");
    await expect(cues).toHaveCount(8);
    await expect(cues.nth(0)).toHaveText("C");
    await expect(cues.nth(1)).toHaveText("G");
    await expect(cues.nth(2)).toHaveText("Am");
    await expect(cues.nth(3)).toHaveText("F");
  });

  test("marks exactly one chord as current", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('.chord-strip-cue[data-state="current"]')).toHaveCount(1);
  });

  test("the marker advances as playback progresses", async ({ page }) => {
    const currentIndex = () =>
      page.locator(".chord-strip-cue").evaluateAll(els =>
        els.findIndex(e => e.getAttribute("data-state") === "current")
      );

    await page.goto("/");
    await expect(page.locator('.chord-strip-cue[data-state="current"]')).toHaveCount(1);
    const early = await currentIndex();

    // Past halfway: a later cue must be current.
    progressMs = Math.floor(DURATION_MS * 0.7);
    await page.reload();
    await expect(page.locator('.chord-strip-cue[data-state="current"]')).toHaveCount(1);
    const late = await currentIndex();

    expect(early).toBe(0);
    expect(late).toBeGreaterThan(early);
  });

  test("highlights a lyric line, not the chord row above it", async ({ page }) => {
    progressMs = Math.floor(DURATION_MS * 0.3);
    await page.goto("/");
    const marked = page.locator(".chord-line-current");
    await expect(marked).toHaveCount(1);
    // A positional unit's highlight belongs on the words.
    const text = (await marked.textContent()) ?? "";
    expect(text.trim().length).toBeGreaterThan(0);
    await expect(marked.locator(".chord")).toHaveCount(0);
  });

  test("the band keeps its height across a track change", async ({ page }) => {
    // Measure the WRAPPER, not `.chord-strip`. The inner band is a fixed height
    // by construction, so asserting on it would pass even while the wrapper
    // jumped around the mobile chord diagram appearing and disappearing.
    await page.setViewportSize({ width: 390, height: 844 }); // phone: the case that reflowed
    await page.goto("/");
    const strip = page.locator(".chord-strip").locator("xpath=..");
    const before = await strip.boundingBox();

    // Content is nulled on a track change; the band must not collapse.
    await page.route("**/api/now-playing", route =>
      route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({
          trackId: "trk-strip-2", title: "Other", artists: ["E2E Band"],
          albumArt: null, progressMs: 0, durationMs: DURATION_MS, isPlaying: true,
        }),
      })
    );
    await page.waitForTimeout(2_500); // one poll cycle
    const after = await page.locator(".chord-strip").locator("xpath=..").boundingBox();
    expect(after?.height).toBe(before?.height);
  });

  test("a font-scale change keeps the highlight on a real line", async ({ page }) => {
    progressMs = Math.floor(DURATION_MS * 0.5);
    await page.goto("/");
    await expect(page.locator(".chord-line-current")).toHaveCount(1);

    await page.getByRole("button", { name: "Larger sheet text" }).click();
    await page.waitForTimeout(400); // debounce + rebuild
    await expect(page.locator(".chord-line-current")).toHaveCount(1);
  });

  test("shows a capo written in a spelling the old parser missed", async ({ page }) => {
    // "Capo on 2nd fret" parsed as null before Task 13. Not {capo: 2}, which
    // always worked and would make this test vacuous.
    const CAPO_SHEET = [
      "{title: Capo Test}",
      "{artist: E2E Band}",
      `{spotify_track_id: ${TRACK_ID}}`,
      "",
      "Capo on 2nd fret",
      "",
      "[C]        [G]",
      "When I find myself in times",
    ].join("\n");

    seedSheet(SHEET_ID, CAPO_SHEET);
    await page.route(`**/api/library/${encodeURIComponent(SHEET_ID)}`, route => {
      if (route.request().method() === "POST") return route.continue();
      return route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ entry: ENTRY, content: CAPO_SHEET }),
      });
    });

    await page.goto("/");
    await expect(page.getByText(/capo 2/i)).toBeVisible();
  });

  test("keeps the source link on a saved sheet", async ({ page }) => {
    const SOURCED = [
      "{title: Source Test}",
      "{artist: E2E Band}",
      `{spotify_track_id: ${TRACK_ID}}`,
      "{source: https://example.com/tab/12345}",
      "",
      "[C]        [G]",
      "When I find myself in times",
    ].join("\n");

    seedSheet(SHEET_ID, SOURCED);
    await page.route(`**/api/library/${encodeURIComponent(SHEET_ID)}`, route => {
      if (route.request().method() === "POST") return route.continue();
      return route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ entry: ENTRY, content: SOURCED }),
      });
    });

    await page.goto("/");
    const link = page.getByRole("link", { name: "source" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "https://example.com/tab/12345");
  });
});
