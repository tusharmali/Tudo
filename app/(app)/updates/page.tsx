import { getCurrentUser } from "@/lib/auth";
import { isManager, isDeptAdmin, canPlan as canPlanFn, manageDeptsOf, wipDeptsFor } from "@/lib/roles";
import { todayStr } from "@/lib/db";
import { listByDate, listForUser, toTree, type TaskNode } from "@/lib/tasks";
import { getWip } from "@/lib/wip";
import { getSettings } from "@/lib/settings";
import { listUsers } from "@/lib/users";
import { renderDayPlan, renderUpdates, autoWipSections, parseWipSections, wipFormatForDept, type WipFormat } from "@/lib/format";
import { aiEnabled } from "@/lib/ai";
import UpdatesTabs, { type AdminData } from "./UpdatesTabs";

export const dynamic = "force-dynamic";

export default async function UpdatesPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const isMgr = isManager(user.role);
  const isDeptAdm = isDeptAdmin(user.role);
  const canPlan = canPlanFn(user); // managers, dept admins, or anyone with extra managed depts
  const managed = new Set(manageDeptsOf(user));
  const wipFormats = ((): WipFormat[] => {
    const fmts = [...new Set(wipDeptsFor(user).map(wipFormatForDept))];
    return fmts.length ? fmts : ["tech"];
  })();
  const today = todayStr();
  const sp = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date || "") ? (sp.date as string) : today;
  const settings = await getSettings();

  const myTasks = await listForUser(user.sub, date);
  const myTree = toTree(myTasks);
  const myWeekTarget = settings[`weektarget:${user.sub}`] || "";
  const savedWipRaw = await getWip(user.sub, date);
  const savedWip = parseWipSections(savedWipRaw);
  const autoWip = autoWipSections(myTree);

  let admin: AdminData | null = null;
  if (canPlan) {
    const [allUsers, allTasks] = await Promise.all([listUsers(), listByDate(date)]);
    // A non-manager only manages the departments assigned to them.
    const users = isMgr ? allUsers : allUsers.filter((u) => managed.has(u.department));
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
      users: users.map((u) => ({ id: u.id, name: u.name, handle: u.handle, department: u.department })),
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
      isAdmin={isMgr}
      isDeptAdmin={isDeptAdm}
      dept={user.dept}
      wipFormats={wipFormats}
      date={date}
      today={today}
      myTree={myTree}
      myWeekTarget={myWeekTarget}
      savedWip={savedWip}
      savedWipRaw={savedWipRaw}
      autoWip={autoWip}
      admin={admin}
    />
  );
}
