import { cookies } from "next/headers";
import { encrypt, decrypt } from "./crypto";
import { getConfig } from "../config";

const COOKIE_NAME = "cp_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

export type Session = { userId: string };

export async function getSession(): Promise<Session | null> {
  const cfg = getConfig();
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const plain = decrypt(raw, cfg.appSecret);
    const parsed = JSON.parse(plain) as Session;
    if (typeof parsed.userId !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setSession(session: Session): Promise<void> {
  const cfg = getConfig();
  const store = await cookies();
  const encrypted = encrypt(JSON.stringify(session), cfg.appSecret);
  store.set(COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
