import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { readTokens, writeTokens, deleteTokens } from "@/lib/auth/tokens";

describe("token store", () => {
  let dir: string;
  const key = randomBytes(32);
  const userId = "testuser123";

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "chordplay-")); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("returns null when tokens file is absent", async () => {
    expect(await readTokens(dir, key, userId)).toBeNull();
  });

  it("writes and reads encrypted tokens", async () => {
    await writeTokens(dir, key, userId, { refreshToken: "r1", scopes: ["s1"], issuedAt: 1000 });
    const out = await readTokens(dir, key, userId);
    expect(out).toEqual({ refreshToken: "r1", scopes: ["s1"], issuedAt: 1000 });
  });

  it("delete removes the file", async () => {
    await writeTokens(dir, key, userId, { refreshToken: "r1", scopes: [], issuedAt: 0 });
    await deleteTokens(dir, userId);
    expect(await readTokens(dir, key, userId)).toBeNull();
  });

  it("writes tokens under users/<userId>/tokens.json", async () => {
    await writeTokens(dir, key, userId, { refreshToken: "r1", scopes: [], issuedAt: 0 });
    expect(existsSync(join(dir, "users", userId, "tokens.json"))).toBe(true);
  });

  it("rejects invalid userId (path traversal)", async () => {
    await expect(readTokens(dir, key, "../evil")).rejects.toThrow(/Invalid userId/);
    await expect(writeTokens(dir, key, "../evil", { refreshToken: "r", scopes: [], issuedAt: 0 })).rejects.toThrow(/Invalid userId/);
    await expect(deleteTokens(dir, "../evil")).rejects.toThrow(/Invalid userId/);
  });

  it("two different users store tokens independently", async () => {
    await writeTokens(dir, key, "user1", { refreshToken: "r1", scopes: [], issuedAt: 0 });
    await writeTokens(dir, key, "user2", { refreshToken: "r2", scopes: [], issuedAt: 0 });
    const t1 = await readTokens(dir, key, "user1");
    const t2 = await readTokens(dir, key, "user2");
    expect(t1?.refreshToken).toBe("r1");
    expect(t2?.refreshToken).toBe("r2");
  });
});
