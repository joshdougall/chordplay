import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { getSession } from "@/lib/auth/session";

type IssueBody = {
  title: string;
  description?: string;
  page?: string;
  userAgent?: string;
};

export async function POST(req: NextRequest) {
  const cfg = getConfig();
  if (!cfg.forgejoIssueToken) {
    return NextResponse.json({ error: "issue reporting not configured" }, { status: 503 });
  }

  const session = await getSession();
  const body = (await req.json()) as IssueBody;

  if (!body.title || body.title.length < 3) {
    return NextResponse.json({ error: "title required (min 3 chars)" }, { status: 400 });
  }

  const issueBody = [
    body.description ?? "",
    "",
    "---",
    `**Reported by:** ${session?.userId ?? "anonymous"}`,
    body.page ? `**Page:** ${body.page}` : null,
    body.userAgent ? `**User-Agent:** ${body.userAgent}` : null,
    `**Timestamp:** ${new Date().toISOString()}`,
  ]
    .filter(line => line !== null)
    .join("\n");

  const res = await fetch(
    `${cfg.forgejoBaseUrl}/api/v1/repos/${cfg.forgejoIssueRepo}/issues`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `token ${cfg.forgejoIssueToken}`,
      },
      body: JSON.stringify({
        title: body.title,
        body: issueBody,
        labels: [],
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: "forgejo rejected", detail: text }, { status: 502 });
  }

  const created = (await res.json()) as { html_url?: string; number?: number };
  return NextResponse.json({ url: created.html_url, number: created.number });
}
