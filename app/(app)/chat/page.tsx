import { getCurrentUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { listForUser, overviewFor } from "@/lib/chat";
import { listUsers, usersMap } from "@/lib/users";
import ChatClient from "./ChatClient";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [chats, users, umap, overview] = await Promise.all([
    listForUser(user.sub),
    listUsers(),
    usersMap(),
    overviewFor(user.sub),
  ]);
  const mgr = isManager(user.role);

  const names: Record<string, { name: string; color: string; avatar: string }> = {};
  for (const u of users) names[u.id] = { name: u.name, color: u.avatarColor, avatar: u.avatar };

  // Employees see DMs within their department + with any manager; managers, all.
  const enriched = chats
    .map((c) => {
      const otherId = c.type === "dm" ? c.memberIds.split(",").map((s) => s.trim()).find((id) => id !== user.sub) || "" : "";
      const other = otherId ? umap[otherId] : undefined;
      const name = c.type === "dm" ? other?.name || "Direct message" : c.name;
      const visible = mgr || c.type !== "dm" || other?.department === user.dept || (other ? isManager(other.role) : false);
      return { id: c.id, type: c.type, name, createdBy: c.createdBy, memberIds: c.memberIds, otherId, visible };
    })
    .filter((c) => c.visible)
    .map(({ id, type, name, createdBy, memberIds, otherId }) => ({ id, type, name, createdBy, memberIds, otherId }));

  const dmUsers = users
    .filter((u) => u.id !== user.sub && (mgr || u.department === user.dept || isManager(u.role)))
    .map((u) => ({ id: u.id, name: u.name }));

  // Managers can edit group membership, so they get the full roster to pick from.
  const allUsers = mgr ? users.map((u) => ({ id: u.id, name: u.name })) : dmUsers;

  return (
    <ChatClient
      me={{ id: user.sub, name: user.name }}
      chats={enriched}
      users={dmUsers}
      allUsers={allUsers}
      names={names}
      overview={overview}
      isAdmin={mgr}
    />
  );
}
