/**
 * Live presence — who's using Tudo right now. Each open, visible tab sends a
 * heartbeat; a user counts as "online" if their last heartbeat is within
 * ONLINE_WINDOW. Kept in its own table so these frequent writes don't churn the
 * Settings read-cache.
 */
import { allRows, appendRow, updateWhere } from "./db";

export const ONLINE_WINDOW_SEC = 125; // a touch over 2× the 60s client heartbeat

export async function heartbeat(userId: string): Promise<void> {
  if (!userId) return;
  const now = new Date().toISOString();
  const changed = await updateWhere("Presence", (r) => r.userId === userId, { lastSeen: now });
  if (!changed) await appendRow("Presence", { userId, lastSeen: now });
}

/** Ids of everyone seen within the window. */
export async function listOnlineIds(windowSec = ONLINE_WINDOW_SEC): Promise<Set<string>> {
  const cutoff = Date.now() - windowSec * 1000;
  const rows = await allRows("Presence");
  const ids = new Set<string>();
  for (const r of rows) {
    const t = r.lastSeen ? Date.parse(r.lastSeen) : 0;
    if (t && t >= cutoff) ids.add(r.userId);
  }
  return ids;
}
