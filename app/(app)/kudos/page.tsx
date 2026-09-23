import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { listKudos, categoryMeta, KUDO_CATEGORIES } from "@/lib/kudos";
import { usersMap, listUsers } from "@/lib/users";
import KudosClient from "./KudosClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kudos" };

export default async function KudosPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [kudos, umap, users] = await Promise.all([listKudos(), usersMap(), listUsers()]);

  // Managers see everything; employees see only their department's recognitions.
  const mgr = isManager(user.role);
  const visible = mgr ? kudos : kudos.filter((k) => umap[k.toUserId]?.department === user.dept);

  const feed = visible.slice(0, 40).map((k) => {
    const cat = categoryMeta(k.category);
    return {
      id: k.id,
      fromName: umap[k.fromUserId]?.name || "Someone",
      toName: umap[k.toUserId]?.name || "Someone",
      emoji: cat.emoji,
      label: cat.label,
      message: k.message,
      when: (k.createdAt || "").slice(0, 16).replace("T", " "),
    };
  });

  const counts: Record<string, number> = {};
  for (const k of visible) counts[k.toUserId] = (counts[k.toUserId] || 0) + 1;
  const leaderboard = Object.entries(counts)
    .map(([id, n]) => ({ name: umap[id]?.name || "Someone", color: umap[id]?.avatarColor || "#7178DD", count: n }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // Employees can only recognize their own department; managers anyone.
  const recipients = users
    .filter((u) => u.id !== user.sub && (mgr || u.department === user.dept))
    .map((u) => ({ id: u.id, name: u.name }));

  return <KudosClient recipients={recipients} feed={feed} leaderboard={leaderboard} categories={KUDO_CATEGORIES} />;
}
