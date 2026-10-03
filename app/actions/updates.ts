"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireManager, requireDayPlanEditor } from "@/lib/dal";
import { isManager, canManageDept, manageDeptsOf } from "@/lib/roles";
import { allRows, appendRows, deleteWhere, genId, todayStr } from "@/lib/db";
import { listByDate, toTree, createTask, setStatus, setUpdate, setContent, removeTask, setWeekTarget, reorderTasks } from "@/lib/tasks";
import { setSetting } from "@/lib/settings";
import { setWip } from "@/lib/wip";
import { listUsers, getUserById } from "@/lib/users";
import { generateOverall } from "@/lib/ai";
import { create as createNotification } from "@/lib/notifications";
import { isNotifyEnabled } from "@/lib/notify-prefs";
import { sendToUsers } from "@/lib/push";
import { actionError, type Res } from "@/lib/action";
import { logAction } from "@/lib/audit";
import type { SessionUser } from "@/lib/types";
import type { WipData } from "@/lib/format";

const STATUSES = ["pending", "in-progress", "done"];
const asDate = (d: string): string => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayStr());

/** A day-plan editor may only touch the departments they manage; managers, anyone. */
async function assertDeptScope(actor: SessionUser, targetUserId: string) {
  if (isManager(actor.role)) return;
  const target = await getUserById(targetUserId);
  if (!target || !canManageDept(actor, target.department)) {
    throw new Error("You can only manage the day plan for your department(s).");
  }
}

/** Find a task by id across all dates and check ownership. */
async function ownTaskOrAdmin(id: string, userId: string, isAdmin: boolean) {
  const tasks = await allRows("Tasks");
  const t = tasks.find((x) => x.id === id);
  if (!t) throw new Error("Task not found.");
  if (!isAdmin && t.userId !== userId) throw new Error("That's not your task.");
  return t;
}

export async function setTaskStatusAction(input: { id: string; status: string }): Promise<Res> {
  try {
    const u = await requireUser();
    await ownTaskOrAdmin(input.id, u.sub, isManager(u.role));
    await setStatus(input.id, STATUSES.includes(input.status) ? input.status : "pending");
    revalidatePath("/updates");
    return { ok: true };
  } catch (e) {
    return actionError(e);
  }
}

export async function saveTaskUpdateAction(input: { id: string; updateText: string }): Promise<Res> {
  try {
    const u = await requireUser();
    await ownTaskOrAdmin(input.id, u.sub, isManager(u.role));
    await setUpdate(input.id, input.updateText);
    revalidatePath("/updates");
    return { ok: true };
  } catch (e) {
    return actionError(e);
  }
}

export async function createTaskAction(input: { userId: string; content: string; parentId?: string; date: string }): Promise<Res<string>> {
  try {
    const admin = await requireDayPlanEditor();
    await assertDeptScope(admin, input.userId);
    if (!input.content.trim()) return { ok: false, error: "Type the task first." };
    const id = await createTask({
      userId: input.userId,
      date: asDate(input.date),
      content: input.content.trim(),
      parentId: input.parentId,
      createdBy: admin.sub,
    });
    await logAction(admin, "Day plan", "Added task", input.content.trim().slice(0, 80));
    revalidatePath("/updates");
    return { ok: true, data: id, message: "Task added" };
  } catch (e) {
    return actionError(e);
  }
}

/** Reorder a set of sibling tasks (drag-and-drop). `ids` is the new order. */
export async function reorderTasksAction(input: { ids: string[] }): Promise<Res> {
  try {
    const admin = await requireDayPlanEditor();
    const ids = (input.ids || []).filter(Boolean);
    if (ids.length < 2) return { ok: true };
    const tasks = await allRows("Tasks");
    const first = tasks.find((t) => t.id === ids[0]);
    if (!first) return { ok: false, error: "Tasks not found." };
    await assertDeptScope(admin, first.userId);
    // Only reorder rows that belong to the same user + sibling group as the first.
    const group = new Set(
      tasks.filter((t) => t.userId === first.userId && (t.parentId || "") === (first.parentId || "")).map((t) => t.id),
    );
    const clean = ids.filter((id) => group.has(id));
    await reorderTasks(clean);
    revalidatePath("/updates");
    return { ok: true };
  } catch (e) {
    return actionError(e);
  }
}

export async function setTaskContentAction(input: { id: string; content: string }): Promise<Res> {
  try {
    const admin = await requireDayPlanEditor();
    const t = (await allRows("Tasks")).find((x) => x.id === input.id);
    if (!t) return { ok: false, error: "Task not found." };
    await assertDeptScope(admin, t.userId);
    if (!input.content.trim()) return { ok: false, error: "Task can't be empty." };
    await setContent(input.id, input.content);
    await logAction(admin, "Day plan", "Edited a task", input.content.trim().slice(0, 80));
    revalidatePath("/updates");
    return { ok: true };
  } catch (e) {
    return actionError(e);
  }
}

/** Manager / day-plan editor: wipe the day's tasks (for the depts they manage). */
export async function resetDayAction(input: { date: string }): Promise<Res> {
  try {
    const admin = await requireDayPlanEditor();
    const date = asDate(input.date);
    const all = await allRows("Tasks");
    let victims = all.filter((t) => t.date === date);
    if (!isManager(admin.role)) {
      const managed = new Set(manageDeptsOf(admin));
      const users = await listUsers();
      const deptIds = new Set(users.filter((u) => managed.has(u.department)).map((u) => u.id));
      victims = victims.filter((t) => deptIds.has(t.userId));
    }
    if (!victims.length) return { ok: false, error: "No tasks to reset for this day." };
    const ids = new Set(victims.map((t) => t.id));
    await deleteWhere("Tasks", (r) => ids.has(r.id));
    await logAction(admin, "Day plan", "Reset the day plan", `${victims.length} tasks · ${date}`);
    revalidatePath("/updates");
    return { ok: true, message: `Cleared ${victims.length} task${victims.length === 1 ? "" : "s"}` };
  } catch (e) {
    return actionError(e);
  }
}

export async function deleteTaskAction(input: { id: string }): Promise<Res> {
  try {
    const admin = await requireDayPlanEditor();
    const t = (await allRows("Tasks")).find((x) => x.id === input.id);
    if (t) await assertDeptScope(admin, t.userId);
    await removeTask(input.id);
    await logAction(admin, "Day plan", "Removed a task", "");
    revalidatePath("/updates");
    return { ok: true, message: "Removed" };
  } catch (e) {
    return actionError(e);
  }
}

export async function setWeekTargetAction(input: { userId: string; text: string }): Promise<Res> {
  try {
    const admin = await requireDayPlanEditor();
    await assertDeptScope(admin, input.userId);
    await setWeekTarget(input.userId, input.text);
    revalidatePath("/updates");
    return { ok: true, message: "Week target saved" };
  } catch (e) {
    return actionError(e);
  }
}

/** Ping a department (or everyone) that their day plan is ready. Managers may
 *  target anyone; a dept admin only their own department(s). */
export async function notifyDayPlanAction(input: { dept: string; message?: string }): Promise<Res> {
  try {
    const me = await requireDayPlanEditor();
    const dept = (input.dept || "all").trim();
    const users = await listUsers();
    let recipients = users.filter((u) => (u.status || "active") !== "suspended" && (dept === "all" || u.department === dept));
    // A dept admin is confined to their own department(s), whatever scope they pick.
    if (!isManager(me.role)) {
      const mine = new Set(manageDeptsOf(me));
      if (dept !== "all" && !mine.has(dept)) return { ok: false, error: "You can only notify your department." };
      recipients = recipients.filter((u) => mine.has(u.department));
    }
    if (!recipients.length) return { ok: false, error: "No one to notify in that scope." };

    const title = "📋 Day plan posted";
    const body = (input.message || "").trim().slice(0, 160) || "Your day plan is ready — check your tasks for today.";
    if (await isNotifyEnabled("dayplan.posted")) {
      const ids = recipients.map((u) => u.id);
      await createNotification(title, body, ids.join(","), me.sub, "/updates");
      await sendToUsers(ids, { title, body, url: "/updates" }).catch(() => {});
    }
    await logAction(me, "Day plan", "Notified team", `${dept === "all" ? "Everyone" : dept} · ${recipients.length}`);
    return { ok: true, message: `Notified ${recipients.length} ${dept === "all" ? "" : dept + " "}teammate${recipients.length === 1 ? "" : "s"}` };
  } catch (e) {
    return actionError(e);
  }
}

export async function setFooterAction(input: { text: string }): Promise<Res> {
  try {
    await requireManager();
    await setSetting("dayplan.footer", input.text);
    revalidatePath("/updates");
    return { ok: true, message: "Footer saved" };
  } catch (e) {
    return actionError(e);
  }
}

export async function saveWipAction(input: { date: string; data: WipData }): Promise<Res> {
  try {
    const u = await requireUser();
    await setWip(u.sub, JSON.stringify(input.data), asDate(input.date));
    revalidatePath("/updates");
    return { ok: true, message: "WIP saved" };
  } catch (e) {
    return actionError(e);
  }
}

export async function generateOverallAction(input: { date: string }): Promise<Res<string>> {
  try {
    await requireManager();
    const date = asDate(input.date);
    const [users, tasks] = await Promise.all([listUsers(), listByDate(date)]);
    const parts: string[] = [];
    for (const u of users) {
      const mine = tasks.filter((t) => t.userId === u.id);
      if (!mine.length) continue;
      const nodes = toTree(mine);
      const lines = nodes.map((n) => {
        const base = n.updateText.trim() || n.content;
        const done = n.status === "done" && !n.updateText.trim() ? " (done)" : "";
        const kids = n.children.map((c) => `  - ${c.updateText.trim() || c.content}`).join("\n");
        return `- ${base}${done}${kids ? "\n" + kids : ""}`;
      });
      parts.push(`${u.name}:\n${lines.join("\n")}`);
    }
    if (!parts.length) return { ok: false, error: "No tasks or updates yet to summarize for this day." };

    const overall = await generateOverall(parts.join("\n\n"));
    await setSetting(`overall:${date}`, overall);
    revalidatePath("/updates");
    return { ok: true, data: overall, message: "Overall update drafted by AI" };
  } catch (e) {
    return actionError(e);
  }
}

/** Copy the most recent prior day's tasks into `date` — fresh, reset to pending. */
export async function copyPreviousDayPlanAction(input: { date: string }): Promise<Res> {
  try {
    const admin = await requireDayPlanEditor();
    const target = asDate(input.date);
    const all = await allRows("Tasks");
    const priorDates = [...new Set(all.filter((t) => t.date && t.date < target).map((t) => t.date))].sort();
    const src = priorDates[priorDates.length - 1];
    if (!src) return { ok: false, error: "No earlier day plan found to copy from." };
    let srcTasks = all.filter((t) => t.date === src);
    // A non-manager only copies tasks from the departments they manage.
    if (!isManager(admin.role)) {
      const managed = new Set(manageDeptsOf(admin));
      const users = await listUsers();
      const deptIds = new Set(users.filter((u) => managed.has(u.department)).map((u) => u.id));
      srcTasks = srcTasks.filter((t) => deptIds.has(t.userId));
    }
    if (!srcTasks.length) return { ok: false, error: "The previous plan has no tasks for your department(s)." };

    const idMap: Record<string, string> = {};
    for (const t of srcTasks) idMap[t.id] = genId("tk");
    const now = new Date().toISOString();
    const rows = srcTasks.map((t) => ({
      id: idMap[t.id],
      userId: t.userId,
      date: target,
      parentId: t.parentId ? idMap[t.parentId] || "" : "",
      content: t.content,
      weekTarget: "",
      section: t.section || "",
      status: "pending",
      updateText: "",
      order: t.order || "0",
      createdBy: admin.sub,
      createdAt: now,
    }));
    await appendRows("Tasks", rows);
    await logAction(admin, "Day plan", "Copied previous day plan", `${rows.length} tasks → ${target}`);
    revalidatePath("/updates");
    return { ok: true, message: `Copied ${rows.length} tasks from ${src.slice(5).replace("-", "/")}` };
  } catch (e) {
    return actionError(e);
  }
}
