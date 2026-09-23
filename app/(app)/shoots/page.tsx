import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { listShoots } from "@/lib/shoots";
import { listUsers } from "@/lib/users";
import ShootsClient from "./ShootsClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shoots & Clients" };

export default async function ShootsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!isManager(user.role) && user.dept !== "Digi") redirect("/dashboard");

  const [shoots, users] = await Promise.all([listShoots(), listUsers()]);
  const nameById: Record<string, string> = {};
  for (const u of users) nameById[u.id] = u.name;
  // Assignee options: Digi team (+ keep it simple).
  const members = users.filter((u) => u.department === "Digi" && (u.status || "active") !== "suspended").map((u) => ({ id: u.id, name: u.name }));

  return (
    <ShootsClient
      canEdit
      members={members}
      nameById={nameById}
      shoots={shoots.map((s) => ({ id: s.id, client: s.client, title: s.title, date: s.date, status: s.status, assigneeId: s.assigneeId, notes: s.notes }))}
    />
  );
}
