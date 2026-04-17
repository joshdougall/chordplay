import { describe, it, expect } from "vitest";
import { createVerifier, challengeFor, createState } from "@/lib/auth/pkce";
import { createHash } from "node:crypto";

describe("pkce", () => {
  it("creates a URL-safe verifier of valid length", () => {
    const v = createVerifier();
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(v.length).toBeLessThanOrEqual(128);
  });

  it("challenge is sha256 of verifier, base64url, no padding", () => {
    const v = "verifier-example";
    const expected = createHash("sha256").update(v).digest("base64url");
    expect(challengeFor(v)).toBe(expected);
  });

  it("state is a distinct random string each call", () => {
    const a = createState();
    const b = createState();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
