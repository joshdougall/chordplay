import { test, expect } from "@playwright/test";
import { rmSync, existsSync } from "node:fs";

test.describe("Unauthenticated landing", () => {
  test.beforeEach(() => {
    if (existsSync("./.e2e-data/data")) rmSync("./.e2e-data/data", { recursive: true });
  });

  test("shows Connect Spotify button when not authenticated", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Connect Spotify/i })).toBeVisible();
  });

  test("Connect Spotify link points to /api/auth/login", async ({ page }) => {
    await page.goto("/");
    const link = page.getByRole("link", { name: /Connect Spotify/i });
    await expect(link).toHaveAttribute("href", "/api/auth/login");
  });
});
