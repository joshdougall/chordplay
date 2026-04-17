import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { encrypt, decrypt } from "@/lib/auth/crypto";

describe("crypto", () => {
  const key = randomBytes(32);

  it("round-trips a payload", () => {
    const plaintext = "refresh-token-xyz";
    const blob = encrypt(plaintext, key);
    const out = decrypt(blob, key);
    expect(out).toBe(plaintext);
  });

  it("fails with wrong key", () => {
    const blob = encrypt("hello", key);
    expect(() => decrypt(blob, randomBytes(32))).toThrow();
  });

  it("produces different ciphertext for same plaintext (nonce randomness)", () => {
    const a = encrypt("same", key);
    const b = encrypt("same", key);
    expect(a).not.toBe(b);
  });
});
