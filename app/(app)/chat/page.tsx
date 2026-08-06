import { getCurrentUser } from "@/lib/auth";
import { listForUser } from "@/lib/chat";
import { listUsers, usersMap } from "@/lib/users";
import ChatClient from "./ChatClient";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [chats, users, umap] = await Promise.all([listForUser(user.sub), listUsers(), usersMap()]);

  const names: Record<string, { name: string; color: string }> = {};
  for (const u of users) names[u.id] = { name: u.name, color: u.avatarColor };

  const enriched = chats.map((c) => {
    let name = c.name;
    if (c.type === "dm") {
      const otherId = c.memberIds.split(",").map((s) => s.trim()).find((id) => id !== user.sub) || "";
      name = umap[otherId]?.name || "Direct message";
    }
    return { id: c.id, type: c.type, name };
  });

  return (
    <ChatClient
      me={{ id: user.sub, name: user.name }}
      chats={enriched}
      users={users.map((u) => ({ id: u.id, name: u.name }))}
      names={names}
      isAdmin={user.role === "superadmin"}
    />
  );
}
