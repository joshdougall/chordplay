import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { recentEvents } from "@/lib/usage/db";

function escapeCsv(value: unknown): string {
  const str = typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const since = Number(url.searchParams.get("since") ?? (Date.now() - 24 * 60 * 60 * 1000));
  const until = Number(url.searchParams.get("until") ?? Date.now());
  const limit = Math.min(5000, Number(url.searchParams.get("limit") ?? 1000));
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const userId = url.searchParams.get("userId") ?? undefined;
  const kind = url.searchParams.get("kind") ?? undefined;

  const events = recentEvents({ since, until, limit, offset, userId, kind });

  const header = "id,ts,iso_time,user_id,kind,payload\n";
  const rows = events
    .map(e =>
      [
        e.id,
        e.ts,
        new Date(e.ts).toISOString(),
        escapeCsv(e.user_id),
        escapeCsv(e.kind),
        escapeCsv(e.payload),
      ].join(",")
    )
    .join("\n");

  return new NextResponse(header + rows, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="chordplay-events-${Date.now()}.csv"`,
    },
  });
}
