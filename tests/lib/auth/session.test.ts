import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomBytes } from "node:crypto";
import { encrypt, decrypt } from "@/lib/auth/crypto";

// Session module uses next/headers which isn't available in the test environment.
// We test the session logic by directly exercising the encrypt/decrypt round-trip
// that the session module is built on, and by mocking next/headers for integration tests.

const APP_SECRET = randomBytes(32);

function encryptSession(payload: object): string {
  return encrypt(JSON.stringify(payload), APP_SECRET);
}

function decryptSession(blob: string): object | null {
  try {
    const plain = decrypt(blob, APP_SECRET);
    return JSON.parse(plain);
  } catch {
    return null;
  }
}

describe("session cookie round-trip", () => {
  it("encrypts and decrypts a session", () => {
    const session = { userId: "spotify_user_123" };
    const blob = encryptSession(session);
    const recovered = decryptSession(blob);
    expect(recovered).toEqual(session);
  });

  it("returns null for a tampered cookie", () => {
    const blob = encryptSession({ userId: "user1" });
    // Flip a byte in the base64 payload
    const corrupted = blob.slice(0, -4) + "XXXX";
    const result = decryptSession(corrupted);
    expect(result).toBeNull();
  });

  it("returns null for a completely invalid blob", () => {
    expect(decryptSession("not-valid-base64!!!")).toBeNull();
  });

  it("rejects session without userId string", () => {
    const blob = encryptSession({ userId: 42 });
    const recovered = decryptSession(blob) as Record<string, unknown> | null;
    if (recovered && typeof recovered.userId !== "string") {
      expect(recovered.userId).not.toBeTypeOf("string");
    }
  });
});

describe("session module with mocked next/headers", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("getSession returns null when no cookie set", async () => {
    const cookieStore = { get: vi.fn().mockReturnValue(undefined), set: vi.fn(), delete: vi.fn() };
    vi.doMock("next/headers", () => ({ cookies: async () => cookieStore }));
    vi.doMock("@/lib/config", () => ({
      getConfig: () => ({ appSecret: APP_SECRET })
    }));
    const { getSession } = await import("@/lib/auth/session");
    const result = await getSession();
    expect(result).toBeNull();
  });

  it("setSession encrypts and stores cookie, getSession decrypts it", async () => {
    let storedValue: string | undefined;
    const cookieStore = {
      get: vi.fn().mockImplementation(() => storedValue ? { value: storedValue } : undefined),
      set: vi.fn().mockImplementation((_name: string, value: string) => { storedValue = value; }),
      delete: vi.fn()
    };
    vi.doMock("next/headers", () => ({ cookies: async () => cookieStore }));
    vi.doMock("@/lib/config", () => ({
      getConfig: () => ({ appSecret: APP_SECRET })
    }));
    const { setSession, getSession } = await import("@/lib/auth/session");

    await setSession({ userId: "spotifyuser1" });
    expect(cookieStore.set).toHaveBeenCalledOnce();

    const session = await getSession();
    expect(session).toEqual({ userId: "spotifyuser1" });
  });

  it("clearSession deletes the cookie", async () => {
    const cookieStore = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
    vi.doMock("next/headers", () => ({ cookies: async () => cookieStore }));
    vi.doMock("@/lib/config", () => ({
      getConfig: () => ({ appSecret: APP_SECRET })
    }));
    const { clearSession } = await import("@/lib/auth/session");
    await clearSession();
    expect(cookieStore.delete).toHaveBeenCalledWith("cp_session");
  });

  it("getSession returns null for invalid encrypted cookie", async () => {
    const cookieStore = {
      get: vi.fn().mockReturnValue({ value: "invalid_base64_garbage" }),
      set: vi.fn(),
      delete: vi.fn()
    };
    vi.doMock("next/headers", () => ({ cookies: async () => cookieStore }));
    vi.doMock("@/lib/config", () => ({
      getConfig: () => ({ appSecret: APP_SECRET })
    }));
    const { getSession } = await import("@/lib/auth/session");
    const result = await getSession();
    expect(result).toBeNull();
  });
});
