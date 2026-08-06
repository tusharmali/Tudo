import { getCurrentUser } from "@/lib/auth";
import { todayStr } from "@/lib/db";
import { listByDate, listForUser, toTree, type TaskNode } from "@/lib/tasks";
import { getWip } from "@/lib/wip";
import { getSettings } from "@/lib/settings";
import { listUsers } from "@/lib/users";
import { renderDayPlan, renderUpdates, wipBodyFromTasks } from "@/lib/format";
import { aiEnabled } from "@/lib/ai";
import UpdatesTabs, { type AdminData } from "./UpdatesTabs";

export const dynamic = "force-dynamic";

export default async function UpdatesPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const isAdmin = user.role === "superadmin";
  const date = todayStr();
  const settings = await getSettings();

  const myTasks = await listForUser(user.sub, date);
  const myTree = toTree(myTasks);
  const myWeekTarget = settings[`weektarget:${user.sub}`] || "";
  const myWip = await getWip(user.sub, date);
  const autoWip = wipBodyFromTasks(myTree);

  let admin: AdminData | null = null;
  if (isAdmin) {
    const [users, allTasks] = await Promise.all([listUsers(), listByDate(date)]);
    const tasksByUser: Record<string, TaskNode[]> = {};
    const weekTargets: Record<string, string> = {};
    for (const u of users) {
      tasksByUser[u.id] = toTree(allTasks.filter((t) => t.userId === u.id));
      weekTargets[u.id] = settings[`weektarget:${u.id}`] || "";
    }
    const footer = settings["dayplan.footer"] || "";
    const withTasks = users.filter((u) => tasksByUser[u.id].length > 0);
    const dayPlanText = renderDayPlan(
      date,
      withTasks.map((u) => ({ handle: u.handle, nodes: tasksByUser[u.id], weekTarget: weekTargets[u.id] })),
      footer,
    );
    const overall = settings[`overall:${date}`] || "";
    const updatesText = renderUpdates(
      date,
      withTasks.map((u) => ({ name: u.name, nodes: tasksByUser[u.id] })),
      overall,
    );
    admin = {
      users: users.map((u) => ({ id: u.id, name: u.name, handle: u.handle })),
      tasksByUser,
      weekTargets,
      footer,
      dayPlanText,
      updatesText,
      aiOn: aiEnabled(),
    };
  }

  return (
    <UpdatesTabs
      isAdmin={isAdmin}
      myTree={myTree}
      myWeekTarget={myWeekTarget}
      myWip={myWip}
      autoWip={autoWip}
      date={date}
      admin={admin}
    />
  );
}
