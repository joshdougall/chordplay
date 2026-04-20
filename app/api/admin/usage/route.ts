import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { recentEvents, eventStats } from "@/lib/usage/db";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const since = Number(url.searchParams.get("since") ?? (Date.now() - 24 * 60 * 60 * 1000));
  const until = Number(url.searchParams.get("until") ?? Date.now());
  const limit = Math.min(500, Number(url.searchParams.get("limit") ?? 100));
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const userId = url.searchParams.get("userId") ?? undefined;
  const kind = url.searchParams.get("kind") ?? undefined;

  const events = recentEvents({ since, until, limit, offset, userId, kind });
  const stats = eventStats(since);
  return NextResponse.json({ events, stats });
}
