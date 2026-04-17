import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { readTokens } from "@/lib/auth/tokens";

export async function GET() {
  const cfg = getConfig();
  const tokens = await readTokens(cfg.dataPath, cfg.appSecret);
  return NextResponse.json({ authenticated: tokens !== null });
}
