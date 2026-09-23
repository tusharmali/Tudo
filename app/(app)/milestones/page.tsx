import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { listAllMilestones } from "@/lib/milestones";
import { usersMap } from "@/lib/users";
import MilestonesClient from "./MilestonesClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Milestones" };

export default async function MilestonesPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const mgr = isManager(user.role);
  if (!mgr && user.dept !== "Support") redirect("/dashboard");

  const [all, umap] = await Promise.all([listAllMilestones(), usersMap()]);
  const visible = mgr ? all : all.filter((m) => m.userId === user.sub);

  return (
    <MilestonesClient
      isManagerView={mgr}
      canAdd={mgr || user.dept === "Support"}
      milestones={visible.map((m) => ({
        id: m.id,
        title: m.title,
        targetDate: m.targetDate,
        status: m.status,
        notes: m.notes,
        ownerName: umap[m.userId]?.name || "Someone",
        ownerDept: umap[m.userId]?.department || "",
      }))}
    />
  );
}
