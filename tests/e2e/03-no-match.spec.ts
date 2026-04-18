import { test, expect } from "@playwright/test";
import { seedAuthentication, setSessionCookie } from "./helpers/session";
import { resetLibrary } from "./helpers/library";

const TRACK_ID = "trk-e2e-no-match";
const TRACK_TITLE = "Unknown Song E2E";
const TRACK_ARTIST = "Unknown Artist E2E";

test.describe("Now-playing with no library match", () => {
  test.beforeEach(async ({ context }) => {
    resetLibrary(); // empty library
    seedAuthentication();
    await setSessionCookie(context);
  });

  test("shows QuickAddForm prefilled with track title when no match found", async ({ page }) => {
    await page.route("**/api/auth/status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ authenticated: true, userId: "e2e_test_user" }),
      })
    );

    await page.route("**/api/now-playing", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          trackId: TRACK_ID,
          title: TRACK_TITLE,
          artists: [TRACK_ARTIST],
          albumArt: null,
          progressMs: 0,
          durationMs: 200000,
          isPlaying: true,
        }),
      })
    );

    // No match in library
    await page.route("**/api/library/match**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ match: null, confidence: null }),
      })
    );

    // External chords: no match
    await page.route("**/api/external/chords**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ match: null }),
      })
    );

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

    await page.route("**/api/spotify/recently-played", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ tracks: [] }),
      })
    );

    await page.goto("/");

    // QuickAddForm appears with the title field prefilled
    const titleInput = page.getByRole("textbox", { name: /title/i });
    await expect(titleInput).toBeVisible({ timeout: 10000 });
    await expect(titleInput).toHaveValue(TRACK_TITLE);
  });
});
