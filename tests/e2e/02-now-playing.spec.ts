import { test, expect } from "@playwright/test";
import { seedAuthentication, setSessionCookie } from "./helpers/session";
import { resetLibrary, seedSheet } from "./helpers/library";

const SHEET_ID = "wonderwall.pro";
const TRACK_ID = "trk-e2e-1";

const SHEET_CONTENT = [
  "{title: Wonderwall}",
  "{artist: Oasis}",
  `{spotify_track_id: ${TRACK_ID}}`,
  "",
  "[Em]Today is [G]gonna be the day",
].join("\n");

test.describe("Now-playing with library match", () => {
  test.beforeEach(async ({ context }) => {
    resetLibrary();
    seedAuthentication();
    seedSheet(SHEET_ID, SHEET_CONTENT);
    await setSessionCookie(context);
  });

  test("renders chord sheet when Spotify is playing a known song", async ({ page }) => {
    // Auth status: authenticated
    await page.route("**/api/auth/status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ authenticated: true, userId: "e2e_test_user" }),
      })
    );

    // Now-playing: return the known track
    await page.route("**/api/now-playing", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          trackId: TRACK_ID,
          title: "Wonderwall",
          artists: ["Oasis"],
          albumArt: null,
          progressMs: 0,
          durationMs: 258000,
          isPlaying: true,
        }),
      })
    );

    // Library match: return the known entry
    await page.route("**/api/library/match**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          match: {
            id: SHEET_ID,
            title: "Wonderwall",
            artist: "Oasis",
            format: "chordpro",
            spotifyTrackId: TRACK_ID,
            parseError: false,
            songKey: "oasis||wonderwall",
          },
          confidence: "exact",
          allMatches: [
            {
              id: SHEET_ID,
              title: "Wonderwall",
              artist: "Oasis",
              format: "chordpro",
              spotifyTrackId: TRACK_ID,
              parseError: false,
              songKey: "oasis||wonderwall",
            },
          ],
        }),
      })
    );

    // Library content fetch: return the sheet content
    await page.route(`**/api/library/${encodeURIComponent(SHEET_ID)}`, (route) => {
      // Skip the spotify-track sub-route (POST)
      if (route.request().method() === "POST") return route.continue();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          entry: {
            id: SHEET_ID,
            title: "Wonderwall",
            artist: "Oasis",
            format: "chordpro",
            spotifyTrackId: TRACK_ID,
            parseError: false,
            songKey: "oasis||wonderwall",
          },
          content: SHEET_CONTENT,
        }),
      });
    });

    // Prefs: return empty defaults so no 401 error
    await page.route("**/api/prefs", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          autoScroll: false,
          showChordDiagrams: true,
          songPreferences: {},
          trackOverrides: {},
          songTranspose: {},
          preferredVersion: {},
          splitView: {},
        }),
      })
    );

    // Recently played: return empty (not playing)
    await page.route("**/api/spotify/recently-played", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ tracks: [] }),
      })
    );

    await page.goto("/");

    await expect(page.locator(".chordpro")).toBeVisible({ timeout: 10000 });
    // ChordSheetJS splits lyrics across .lyrics spans — check a lyric fragment is present
    await expect(page.locator(".chordpro .lyrics").first()).toBeVisible();
    // Verify the chord sheet has the right song header
    await expect(page.locator(".chordpro h1.title")).toContainText("Wonderwall");
    // Verify lyric content is present in at least one lyrics span
    await expect(page.locator(".chordpro .lyrics", { hasText: "Today" })).toBeVisible();
  });
});
