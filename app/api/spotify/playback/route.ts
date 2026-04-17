import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { getAccessToken } from "@/lib/auth/spotify";
import { getSession } from "@/lib/auth/session";

type Action = "toggle" | "next" | "previous";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const cfg = getConfig();
  const action = new URL(req.url).searchParams.get("action") as Action | null;
  if (!action || !["toggle", "next", "previous"].includes(action)) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  let token: string;
  try {
    token = await getAccessToken(cfg, session.userId);
  } catch {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Length": "0"
  };

  if (action === "toggle") {
    // Check current playback state
    const stateRes = await fetch("https://api.spotify.com/v1/me/player", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (stateRes.status === 403) return NextResponse.json({ error: "insufficient scope" }, { status: 403 });
    if (stateRes.status === 204 || !stateRes.ok) {
      // No active device or error — try play anyway
      const res = await fetch("https://api.spotify.com/v1/me/player/play", { method: "PUT", headers });
      if (res.status === 403) return NextResponse.json({ error: "insufficient scope" }, { status: 403 });
      return NextResponse.json({ ok: true });
    }
    const state = await stateRes.json();
    const isPlaying = state?.is_playing === true;
    const endpoint = isPlaying
      ? "https://api.spotify.com/v1/me/player/pause"
      : "https://api.spotify.com/v1/me/player/play";
    const res = await fetch(endpoint, { method: "PUT", headers });
    if (res.status === 403) return NextResponse.json({ error: "insufficient scope" }, { status: 403 });
    return NextResponse.json({ ok: true });
  }

  if (action === "next") {
    const res = await fetch("https://api.spotify.com/v1/me/player/next", { method: "POST", headers });
    if (res.status === 403) return NextResponse.json({ error: "insufficient scope" }, { status: 403 });
    return NextResponse.json({ ok: true });
  }

  if (action === "previous") {
    const res = await fetch("https://api.spotify.com/v1/me/player/previous", { method: "POST", headers });
    if (res.status === 403) return NextResponse.json({ error: "insufficient scope" }, { status: 403 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
