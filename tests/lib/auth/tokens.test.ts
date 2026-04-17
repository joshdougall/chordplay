import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { readTokens, writeTokens, deleteTokens } from "@/lib/auth/tokens";

describe("token store", () => {
  let dir: string;
  const key = randomBytes(32);

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "chordplay-")); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("returns null when tokens file is absent", async () => {
    expect(await readTokens(dir, key)).toBeNull();
  });

  it("writes and reads encrypted tokens", async () => {
    await writeTokens(dir, key, { refreshToken: "r1", scopes: ["s1"], issuedAt: 1000 });
    const out = await readTokens(dir, key);
    expect(out).toEqual({ refreshToken: "r1", scopes: ["s1"], issuedAt: 1000 });
  });

  it("delete removes the file", async () => {
    await writeTokens(dir, key, { refreshToken: "r1", scopes: [], issuedAt: 0 });
    await deleteTokens(dir);
    expect(await readTokens(dir, key)).toBeNull();
  });
});
