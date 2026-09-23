import { getCurrentUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { listForUser } from "@/lib/chat";
import { listUsers, usersMap } from "@/lib/users";
import ChatClient from "./ChatClient";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [chats, users, umap] = await Promise.all([listForUser(user.sub), listUsers(), usersMap()]);
  const mgr = isManager(user.role);

  const names: Record<string, { name: string; color: string }> = {};
  for (const u of users) names[u.id] = { name: u.name, color: u.avatarColor };

  // Employees can only see / start conversations within their own department.
  const enriched = chats
    .map((c) => {
      const otherId = c.type === "dm" ? c.memberIds.split(",").map((s) => s.trim()).find((id) => id !== user.sub) || "" : "";
      const name = c.type === "dm" ? umap[otherId]?.name || "Direct message" : c.name;
      return { id: c.id, type: c.type, name, otherDept: otherId ? umap[otherId]?.department || "" : "" };
    })
    .filter((c) => mgr || c.type !== "dm" || c.otherDept === user.dept)
    .map(({ id, type, name }) => ({ id, type, name }));

  const dmUsers = users
    .filter((u) => u.id !== user.sub && (mgr || u.department === user.dept))
    .map((u) => ({ id: u.id, name: u.name }));

  return (
    <ChatClient
      me={{ id: user.sub, name: user.name }}
      chats={enriched}
      users={dmUsers}
      names={names}
      isAdmin={mgr}
    />
  );
}
