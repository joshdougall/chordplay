import { test, expect } from "@playwright/test";
import { seedAuthentication, setSessionCookie, FAKE_USER_ID } from "./helpers/session";
import { resetLibrary, seedSheet } from "./helpers/library";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const SHEET_ID = "transpose-test.pro";
const TRACK_ID = "trk-transpose-1";

const SHEET_CONTENT = [
  "{title: Transpose Test}",
  "{artist: E2E Band}",
  `{spotify_track_id: ${TRACK_ID}}`,
  "",
  "[C]Hello [G]world [Am]here",
].join("\n");

const ENTRY = {
  id: SHEET_ID,
  title: "Transpose Test",
  artist: "E2E Band",
  format: "chordpro",
  spotifyTrackId: TRACK_ID,
  parseError: false,
  songKey: "e2e-band||transpose-test",
};

function mockCommonRoutes(page: import("@playwright/test").Page, transposeOverride?: Record<string, number>) {
  const songTranspose: Record<string, number> = transposeOverride ?? {};

  page.route("**/api/auth/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: true, userId: FAKE_USER_ID }),
    })
  );

  page.route("**/api/now-playing", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        trackId: TRACK_ID,
        title: "Transpose Test",
        artists: ["E2E Band"],
        albumArt: null,
        progressMs: 0,
        durationMs: 200000,
        isPlaying: true,
      }),
    })
  );

  page.route("**/api/library/match**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ match: ENTRY, confidence: "exact", allMatches: [ENTRY] }),
    })
  );

  page.route(`**/api/library/${encodeURIComponent(SHEET_ID)}`, (route) => {
    if (route.request().method() === "POST") return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ entry: ENTRY, content: SHEET_CONTENT }),
    });
  });

  page.route("**/api/spotify/recently-played", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ tracks: [] }),
    })
  );

  page.route("**/api/prefs", (route) => {
    if (route.request().method() === "PUT") return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        autoScroll: false,
        showChordDiagrams: true,
        songPreferences: {},
        trackOverrides: {},
        songTranspose,
        preferredVersion: {},
        splitView: {},
      }),
    });
  });
}

test.describe("Transpose persistence", () => {
  test.beforeEach(async ({ context }) => {
    resetLibrary();
    seedAuthentication();
    seedSheet(SHEET_ID, SHEET_CONTENT);
    await setSessionCookie(context);
  });

  test("transpose value is persisted to prefs and restored on reload", async ({ page }) => {
    await mockCommonRoutes(page);

    await page.goto("/");

    // Wait for chord sheet to render
    await expect(page.locator(".chordpro")).toBeVisible({ timeout: 10000 });

    // Transpose up twice using the + button
    const transposeUp = page.getByRole("button", { name: /Transpose up/i });
    await expect(transposeUp).toBeVisible();
    await transposeUp.click();
    await transposeUp.click();

    // Verify the transpose display shows +2
    const transposeDisplay = page.locator("span.tabular-nums");
    await expect(transposeDisplay).toHaveText("+2");

    // Read the prefs file to verify it was actually persisted to disk
    // (The PUT /api/prefs route goes through to the real server)
    const prefsPath = join("./.e2e-data/data", "users", FAKE_USER_ID, "prefs.json");

    // Give the PUT request a moment to write
    await page.waitForTimeout(500);

    // Verify the prefs file exists and has the correct transpose
    expect(existsSync(prefsPath)).toBe(true);
    const saved = JSON.parse(readFileSync(prefsPath, "utf8"));
    expect(saved.songTranspose?.[SHEET_ID]).toBe(2);

    // Reload page — now serve the saved transpose value back from prefs
    const savedTranspose = saved.songTranspose ?? {};
    await page.unrouteAll();
    await mockCommonRoutes(page, savedTranspose);

    await page.reload();
    await expect(page.locator(".chordpro")).toBeVisible({ timeout: 10000 });

    // Transpose display should still read +2
    await expect(page.locator("span.tabular-nums")).toHaveText("+2");
  });
});
