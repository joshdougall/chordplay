import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { readTokens } from "@/lib/auth/tokens";
import { getAccessToken } from "@/lib/auth/spotify";
import { getSession } from "@/lib/auth/session";
import { logger } from "@/lib/logger";

type CachedProfile = { at: number; displayName: string | null; avatarUrl: string | null; email: string | null };
const PROFILE_TTL_MS = 60 * 60 * 1000; // 1h — slightly under 24h Spotify cache rule
const profileCache = new Map<string, CachedProfile>();

async function fetchProfile(userId: string) {
  const cached = profileCache.get(userId);
  if (cached && Date.now() - cached.at < PROFILE_TTL_MS) return cached;

  const cfg = getConfig();
  let token: string;
  try { token = await getAccessToken(cfg, userId); }
  catch { return null; }

  try {
    const res = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      logger.warn({ userId, status: res.status }, "spotify /me fetch failed");
      return cached ?? null;
    }
    const data = await res.json() as {
      display_name?: string;
      email?: string;
      images?: Array<{ url: string; height: number | null; width: number | null }>;
    };
    const avatar = data.images?.sort((a, b) => (b.height ?? 0) - (a.height ?? 0))[0]?.url ?? null;
    const profile: CachedProfile = {
      at: Date.now(),
      displayName: data.display_name ?? null,
      avatarUrl: avatar,
      email: data.email ?? null,
    };
    profileCache.set(userId, profile);
    return profile;
  } catch (err) {
    logger.warn({ userId, err: (err as Error).message }, "spotify /me fetch threw");
    return cached ?? null;
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ authenticated: false });
  const cfg = getConfig();
  const tokens = await readTokens(cfg.dataPath, cfg.appSecret, session.userId);
  if (!tokens) return NextResponse.json({ authenticated: false });
  const profile = await fetchProfile(session.userId);
  return NextResponse.json({
    authenticated: true,
    userId: session.userId,
    displayName: profile?.displayName ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
  });
}
