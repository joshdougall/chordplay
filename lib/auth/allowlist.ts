/**
 * Who may sign in at all.
 *
 * The OAuth callback previously set a session for any Spotify account that
 * completed the flow. The library is shared and global, so that meant anyone
 * could reach DELETE /api/library/<id> on every sheet. The only thing standing
 * in the way was the Spotify app's mode — and this app is in extended quota
 * mode, verified by GET /v1/tracks?ids= still working, an endpoint removed for
 * Development Mode apps on 2026-03-09. So the exposure was real, not theoretical.
 *
 * Unset means no allowlist, which keeps the open-source default working. Set
 * CHORDPLAY_ALLOWED_USERS to lock a deployment to known Spotify user ids.
 */
export function parseAllowedUsers(raw: string | undefined): string[] {
  return (raw ?? "").split(",").map(s => s.trim()).filter(Boolean);
}

export function isUserAllowed(userId: string, allowed: string[] | undefined): boolean {
  // Absent and empty both mean "no allowlist". They are indistinguishable from
  // unset config, and the documented default is open, so this must not throw
  // or lock the owner out of their own instance.
  if (!allowed || allowed.length === 0) return true;
  if (!userId) return false;
  const needle = userId.toLowerCase();
  return allowed.some(a => a.toLowerCase() === needle);
}
