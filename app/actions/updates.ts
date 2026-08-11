"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireAdmin } from "@/lib/dal";
import { allRows, appendRows, genId, todayStr } from "@/lib/db";
import { listByDate, toTree, createTask, setStatus, setUpdate, removeTask, setWeekTarget } from "@/lib/tasks";
import { setSetting } from "@/lib/settings";
import { setWip } from "@/lib/wip";
import { listUsers } from "@/lib/users";
import { generateOverall } from "@/lib/ai";
import { actionError, type Res } from "@/lib/action";
import type { WipSections } from "@/lib/format";

const STATUSES = ["pending", "in-progress", "done"];
const asDate = (d: string): string => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayStr());

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
    await ownTaskOrAdmin(input.id, u.sub, u.role === "superadmin");
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
    await ownTaskOrAdmin(input.id, u.sub, u.role === "superadmin");
    await setUpdate(input.id, input.updateText);
    revalidatePath("/updates");
    return { ok: true };
  } catch (e) {
    return actionError(e);
  }
}

export async function createTaskAction(input: { userId: string; content: string; parentId?: string; date: string }): Promise<Res> {
  try {
    const admin = await requireAdmin();
    if (!input.content.trim()) return { ok: false, error: "Type the task first." };
    await createTask({
      userId: input.userId,
      date: asDate(input.date),
      content: input.content.trim(),
      parentId: input.parentId,
      createdBy: admin.sub,
    });
    revalidatePath("/updates");
    return { ok: true, message: "Task added" };
  } catch (e) {
    return actionError(e);
  }
}

export async function deleteTaskAction(input: { id: string }): Promise<Res> {
  try {
    await requireAdmin();
    await removeTask(input.id);
    revalidatePath("/updates");
    return { ok: true, message: "Removed" };
  } catch (e) {
    return actionError(e);
  }
}

export async function setWeekTargetAction(input: { userId: string; text: string }): Promise<Res> {
  try {
    await requireAdmin();
    await setWeekTarget(input.userId, input.text);
    revalidatePath("/updates");
    return { ok: true, message: "Week target saved" };
  } catch (e) {
    return actionError(e);
  }
}

export async function setFooterAction(input: { text: string }): Promise<Res> {
  try {
    await requireAdmin();
    await setSetting("dayplan.footer", input.text);
    revalidatePath("/updates");
    return { ok: true, message: "Footer saved" };
  } catch (e) {
    return actionError(e);
  }
}

export async function saveWipAction(input: { date: string; sections: WipSections }): Promise<Res> {
  try {
    const u = await requireUser();
    await setWip(u.sub, JSON.stringify(input.sections), asDate(input.date));
    revalidatePath("/updates");
    return { ok: true, message: "WIP saved" };
  } catch (e) {
    return actionError(e);
  }
}

export async function generateOverallAction(input: { date: string }): Promise<Res<string>> {
  try {
    await requireAdmin();
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
    const admin = await requireAdmin();
    const target = asDate(input.date);
    const all = await allRows("Tasks");
    const priorDates = [...new Set(all.filter((t) => t.date && t.date < target).map((t) => t.date))].sort();
    const src = priorDates[priorDates.length - 1];
    if (!src) return { ok: false, error: "No earlier day plan found to copy from." };
    const srcTasks = all.filter((t) => t.date === src);
    if (!srcTasks.length) return { ok: false, error: "The previous plan has no tasks." };

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
    revalidatePath("/updates");
    return { ok: true, message: `Copied ${rows.length} tasks from ${src.slice(5).replace("-", "/")}` };
  } catch (e) {
    return actionError(e);
  }
}
