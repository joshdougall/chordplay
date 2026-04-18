import { test, expect } from "@playwright/test";
import { seedAuthentication, setSessionCookie } from "./helpers/session";
import { resetLibrary, seedSheet } from "./helpers/library";

const SHEETS = [
  { id: "hotel-california.pro", title: "Hotel California", artist: "Eagles", trackId: "trk-hc" },
  { id: "bohemian-rhapsody.pro", title: "Bohemian Rhapsody", artist: "Queen", trackId: "trk-br" },
  { id: "stairway.pro", title: "Stairway to Heaven", artist: "Led Zeppelin", trackId: "trk-sh" },
];

function makeSheet(title: string, artist: string, trackId: string): string {
  return [
    `{title: ${title}}`,
    `{artist: ${artist}}`,
    `{spotify_track_id: ${trackId}}`,
    "",
    "[G]Some lyrics here",
  ].join("\n");
}

test.describe("Library browse and filter", () => {
  test.beforeEach(async ({ context }) => {
    resetLibrary();
    seedAuthentication();
    for (const s of SHEETS) {
      seedSheet(s.id, makeSheet(s.title, s.artist, s.trackId));
    }
    await setSessionCookie(context);
  });

  test("shows all three library cards", async ({ page }) => {
    // Stub Spotify album art so library page doesn't fail on 401
    await page.route("**/api/spotify/tracks**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ tracks: [] }),
      })
    );

    await page.goto("/library");

    for (const s of SHEETS) {
      await expect(page.getByText(s.title, { exact: false })).toBeVisible({ timeout: 10000 });
    }
  });

  test("filter narrows to matching cards only", async ({ page }) => {
    await page.route("**/api/spotify/tracks**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ tracks: [] }),
      })
    );

    await page.goto("/library");

    // Wait for cards to load
    await expect(page.getByText("Hotel California", { exact: false })).toBeVisible({
      timeout: 10000,
    });

    // Focus the filter and type
    const filterInput = page.getByPlaceholder(/Filter by title or artist/i);
    await filterInput.fill("Queen");

    // Only Queen card should remain visible; others should be gone
    await expect(page.getByText("Bohemian Rhapsody", { exact: false })).toBeVisible();
    await expect(page.getByText("Hotel California", { exact: false })).not.toBeVisible();
    await expect(page.getByText("Stairway to Heaven", { exact: false })).not.toBeVisible();
  });
});
