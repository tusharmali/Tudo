import { getCurrentUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { listUsers } from "@/lib/users";
import { chatViewFor } from "@/lib/chat-view";
import { getChatTheme } from "@/lib/chat";
import ChatClient from "./ChatClient";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [{ chats, overview }, users, theme] = await Promise.all([chatViewFor(user), listUsers(), getChatTheme(user.sub)]);
  const mgr = isManager(user.role);

  const names: Record<string, { name: string; color: string; avatar: string }> = {};
  for (const u of users) names[u.id] = { name: u.name, color: u.avatarColor, avatar: u.avatar };

  const dmUsers = users
    .filter((u) => u.id !== user.sub && (mgr || u.department === user.dept || isManager(u.role)))
    .map((u) => ({ id: u.id, name: u.name }));

  // Managers can edit group membership, so they get the full roster to pick from.
  const allUsers = mgr ? users.map((u) => ({ id: u.id, name: u.name })) : dmUsers;

  return (
    <ChatClient
      me={{ id: user.sub, name: user.name }}
      chats={chats}
      users={dmUsers}
      allUsers={allUsers}
      names={names}
      overview={overview}
      theme={theme}
      isAdmin={mgr}
    />
  );
}
