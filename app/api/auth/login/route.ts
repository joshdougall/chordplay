import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getConfig } from "@/lib/config";
import { createVerifier, challengeFor, createState } from "@/lib/auth/pkce";

const SCOPES = [
  "user-read-playback-state",
  "user-read-currently-playing",
  "user-modify-playback-state"
].join(" ");

export async function GET() {
  const cfg = getConfig();
  const verifier = createVerifier();
  const challenge = challengeFor(verifier);
  const state = createState();

  const cookieStore = await cookies();
  const opts = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: 600 };
  cookieStore.set("cp_pkce", verifier, opts);
  cookieStore.set("cp_state", state, opts);

  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("client_id", cfg.spotifyClientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", cfg.spotifyRedirectUri);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", SCOPES);

  return NextResponse.redirect(url.toString(), { status: 302 });
}
