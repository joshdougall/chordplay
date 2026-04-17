import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getConfig } from "@/lib/config";
import { writeTokens } from "@/lib/auth/tokens";

export async function GET(req: NextRequest) {
  const cfg = getConfig();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  if (err) return NextResponse.redirect(new URL("/?error=" + encodeURIComponent(err), req.url));
  if (!code || !state) return NextResponse.json({ error: "missing code or state" }, { status: 400 });

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("cp_state")?.value;
  const verifier = cookieStore.get("cp_pkce")?.value;
  if (!expectedState || !verifier || expectedState !== state) {
    return NextResponse.json({ error: "state mismatch" }, { status: 400 });
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: cfg.spotifyRedirectUri,
    client_id: cfg.spotifyClientId,
    code_verifier: verifier
  });

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${cfg.spotifyClientId}:${cfg.spotifyClientSecret}`).toString("base64")
    },
    body
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    return NextResponse.json({ error: "token exchange failed", detail: text }, { status: 502 });
  }

  const data = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    scope: string;
    expires_in: number;
    token_type: string;
  };

  await writeTokens(cfg.dataPath, cfg.appSecret, {
    refreshToken: data.refresh_token,
    scopes: data.scope.split(" "),
    issuedAt: Date.now()
  });

  cookieStore.delete("cp_pkce");
  cookieStore.delete("cp_state");

  return NextResponse.redirect(new URL("/", req.url));
}
