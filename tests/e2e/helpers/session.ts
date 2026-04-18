import { mkdirSync, writeFileSync } from "node:fs";
import { createCipheriv, randomBytes } from "node:crypto";
import { join } from "node:path";
import type { BrowserContext } from "@playwright/test";

export const FAKE_USER_ID = "e2e_test_user";
const DATA_ROOT = "./.e2e-data/data";

// Match the AES-GCM blob format from lib/auth/crypto.ts:
// base64(iv[12] | authTag[16] | ciphertext)
function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function appSecret(): Buffer {
  return Buffer.from(
    process.env.APP_SECRET ?? Buffer.alloc(32).toString("base64"),
    "base64"
  );
}

export function seedAuthentication(): void {
  const key = appSecret();
  const userDir = join(DATA_ROOT, "users", FAKE_USER_ID);
  mkdirSync(userDir, { recursive: true });

  const stored = {
    blob: encrypt("fake-refresh-token", key),
    scopes: ["user-read-playback-state", "user-read-currently-playing"],
    issuedAt: Date.now(),
  };

  writeFileSync(join(userDir, "tokens.json"), JSON.stringify(stored));
}

export async function setSessionCookie(context: BrowserContext): Promise<void> {
  const key = appSecret();
  const sessionValue = encrypt(JSON.stringify({ userId: FAKE_USER_ID }), key);
  await context.addCookies([
    {
      name: "cp_session",
      value: sessionValue,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}
