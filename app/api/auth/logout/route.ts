import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { deleteTokens } from "@/lib/auth/tokens";
import { clearAccessTokenCache } from "@/lib/auth/spotify";
import { getSession, clearSession } from "@/lib/auth/session";

export async function POST() {
  const cfg = getConfig();
  const session = await getSession();
  if (session) {
    await deleteTokens(cfg.dataPath, session.userId);
    clearAccessTokenCache(session.userId);
  }
  await clearSession();
  return NextResponse.json({ ok: true });
}
