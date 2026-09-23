/**
 * Builds a user's chat list (with the same visibility scoping the page uses)
 * plus the per-chat overview. Shared by the chat page and the overview API so
 * the list can update live — new groups you're added to, or new DMs, appear
 * without a reload.
 */
import { isManager } from "./roles";
import { listForUser, overviewFor, type ChatOverview } from "./chat";
import { usersMap } from "./users";
import type { SessionUser } from "./types";

export interface EnrichedChat {
  id: string;
  type: string;
  name: string;
  createdBy: string;
  memberIds: string;
  otherId: string;
}

export async function chatViewFor(user: SessionUser): Promise<{ chats: EnrichedChat[]; overview: Record<string, ChatOverview> }> {
  const [chats, umap, overview] = await Promise.all([listForUser(user.sub), usersMap(), overviewFor(user.sub)]);
  const mgr = isManager(user.role);

  const enriched = chats
    .map((c) => {
      const otherId = c.type === "dm" ? c.memberIds.split(",").map((s) => s.trim()).find((id) => id !== user.sub) || "" : "";
      const other = otherId ? umap[otherId] : undefined;
      const name = c.type === "dm" ? other?.name || "Direct message" : c.name;
      // Employees see group chats they're in + DMs within their dept or with a manager.
      const visible = mgr || c.type !== "dm" || other?.department === user.dept || (other ? isManager(other.role) : false);
      return { id: c.id, type: c.type, name, createdBy: c.createdBy, memberIds: c.memberIds, otherId, visible };
    })
    .filter((c) => c.visible)
    .map(({ visible: _v, ...rest }) => rest);

  return { chats: enriched, overview };
}
