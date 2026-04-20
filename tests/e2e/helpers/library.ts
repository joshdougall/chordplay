import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

const LIB_ROOT = "./.e2e-data/library";

export function resetLibrary(): void {
  if (existsSync(LIB_ROOT)) rmSync(LIB_ROOT, { recursive: true });
  mkdirSync(LIB_ROOT, { recursive: true });
}

export function seedSheet(relativePath: string, content: string): void {
  const full = join(LIB_ROOT, relativePath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}
