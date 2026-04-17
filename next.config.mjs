import { fileURLToPath } from "url";
import path from "path";
import { readFileSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync("./package.json", "utf8"));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: __dirname,
  serverExternalPackages: ["chokidar", "@coderline/alphatab"],
  env: { NEXT_PUBLIC_APP_VERSION: `v${pkg.version}` }
};

export default nextConfig;
