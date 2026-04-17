import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { deleteTokens } from "@/lib/auth/tokens";
import { clearAccessTokenCache } from "@/lib/auth/spotify";

export async function POST() {
  const cfg = getConfig();
  await deleteTokens(cfg.dataPath);
  clearAccessTokenCache();
  return NextResponse.json({ ok: true });
}
