import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { isManager, canPlan, canManageDept, manageDeptsOf } from "@/lib/roles";
import { listUsers } from "@/lib/users";
import { boardFor, boardSummaries } from "@/lib/tasks";
import { todayStr } from "@/lib/db";
import BoardClient from "./BoardClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Board" };

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ u?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const today = todayStr();
  const sp = await searchParams;
  const planner = canPlan(user);
  const users = await listUsers();

  // Which board are we looking at — your own, or a teammate's (planners only)?
  let viewId = user.sub;
  if (sp.u && sp.u !== user.sub) {
    const t = users.find((u) => u.id === sp.u);
    if (t && (isManager(user.role) || canManageDept(user, t.department))) viewId = sp.u;
  }
  const viewed = users.find((u) => u.id === viewId) || users.find((u) => u.id === user.sub)!;
  const canEdit = viewId === user.sub || isManager(user.role) || canManageDept(user, viewed.department);

  const cols = await boardFor(viewId, today);

  let team: Awaited<ReturnType<typeof buildTeam>> = [];
  if (planner) team = await buildTeam();

  async function buildTeam() {
    const scope = isManager(user!.role) ? users : users.filter((u) => manageDeptsOf(user!).includes(u.department));
    const active = scope.filter((u) => (u.status || "active") !== "suspended");
    const sums = await boardSummaries(active.map((u) => u.id), today);
    return active
      .map((u) => ({ id: u.id, name: u.name, dept: u.department || "—", avatar: u.avatar, color: u.avatarColor, ...sums[u.id] }))
      .sort((a, b) => b.doing - a.doing || b.todo - a.todo || a.name.localeCompare(b.name));
  }

  return (
    <BoardClient
      cols={cols}
      viewUser={{ id: viewed.id, name: viewed.name, avatar: viewed.avatar, color: viewed.avatarColor }}
      isSelf={viewId === user.sub}
      canEdit={canEdit}
      team={team}
      date={today}
      viewerIsPlanner={planner}
    />
  );
}
