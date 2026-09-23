import { getCurrentUser } from "@/lib/auth";
import { isManager, roleLabel } from "@/lib/roles";
import { listRelated, allReplies } from "@/lib/concerns";
import { listUsers, usersMap } from "@/lib/users";
import ConcernsClient, { type ConcernRow, type ReplyRow } from "./ConcernsClient";

export const dynamic = "force-dynamic";

export default async function ConcernsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [related, replies, umap, users] = await Promise.all([
    listRelated(user.sub),
    allReplies(),
    usersMap(),
    listUsers(),
  ]);

  const ids = new Set(related.map((c) => c.id));
  const repliesByConcern: Record<string, ReplyRow[]> = {};
  for (const r of replies) {
    if (!ids.has(r.concernId)) continue;
    (repliesByConcern[r.concernId] ||= []).push({
      userId: r.userId,
      userName: umap[r.userId]?.name || "Unknown",
      message: r.message,
    });
  }

  const concerns: ConcernRow[] = related.map((c) => ({
    id: c.id,
    subject: c.subject,
    message: c.message,
    status: c.status,
    fromUserId: c.fromUserId,
    toUserId: c.toUserId,
    fromName: umap[c.fromUserId]?.name || "Unknown",
    toName: umap[c.toUserId]?.name || "Unknown",
    direction: c.fromUserId === user.sub ? "sent" : "received",
  }));

  const recipients = users
    .filter((u) => isManager(u.role) && (u.status || "active") !== "suspended")
    .map((u) => ({ id: u.id, name: u.name, role: roleLabel(u.role) }));

  return <ConcernsClient me={user.sub} concerns={concerns} repliesByConcern={repliesByConcern} recipients={recipients} />;
}
