import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { readTokens } from "@/lib/auth/tokens";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ authenticated: false });
  const cfg = getConfig();
  const tokens = await readTokens(cfg.dataPath, cfg.appSecret, session.userId);
  if (!tokens) return NextResponse.json({ authenticated: false });
  return NextResponse.json({ authenticated: true, userId: session.userId });
}
