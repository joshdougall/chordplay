import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const existing = req.headers.get("x-request-id");
  const reqId = existing ?? crypto.randomUUID();
  const res = NextResponse.next();
  res.headers.set("x-request-id", reqId);
  // Propagate inbound header so route handlers can read it consistently
  if (!existing) req.headers.set("x-request-id", reqId);
  return res;
}

export const config = { matcher: ["/api/:path*"] };
