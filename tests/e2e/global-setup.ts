import { mkdirSync } from "node:fs";

async function globalSetup() {
  // Ensure the e2e data directories exist before the web server health check runs.
  // The health endpoint checks that both LIBRARY_PATH and DATA_PATH are accessible.
  mkdirSync("./.e2e-data/library", { recursive: true });
  mkdirSync("./.e2e-data/data", { recursive: true });
}

export default globalSetup;
