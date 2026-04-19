import { getConfig } from "@/lib/config";
import { getSession } from "@/lib/auth/session";

export async function requireAdmin(): Promise<{ userId: string } | null> {
  const session = await getSession();
  if (!session) return null;
  const cfg = getConfig();
  if (!cfg.adminUserIds.includes(session.userId)) return null;
  return { userId: session.userId };
}
