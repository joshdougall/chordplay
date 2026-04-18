import { defineConfig } from "@playwright/test";

export default defineConfig({
  globalSetup: "./tests/e2e/global-setup.ts",
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      APP_SECRET: Buffer.alloc(32).toString("base64"),
      SPOTIFY_CLIENT_ID: "test-client-id",
      SPOTIFY_CLIENT_SECRET: "test-client-secret",
      SPOTIFY_REDIRECT_URI: "http://127.0.0.1:3000/api/auth/callback",
      LIBRARY_PATH: "./.e2e-data/library",
      DATA_PATH: "./.e2e-data/data",
      NODE_ENV: "test",
    },
  },
});
