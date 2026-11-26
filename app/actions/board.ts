"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { isManager, canManageDept } from "@/lib/roles";
import { allRows, todayStr } from "@/lib/db";
import { moveTask, createTask, removeTask } from "@/lib/tasks";
import { getUserById } from "@/lib/users";
import { logAction } from "@/lib/audit";
import { actionError, type Res } from "@/lib/action";
import type { SessionUser } from "@/lib/types";

type Column = "backlog" | "todo" | "doing" | "done";

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00+05:30`);
  d.setDate(d.getDate() + n);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function target(col: Column, date: string): { date: string; status: string } {
  if (col === "backlog") return { date: "", status: "pending" };
  if (col === "doing") return { date, status: "in-progress" };
  if (col === "done") return { date, status: "done" };
  return { date, status: "pending" }; // todo (day target)
}

/** You can always arrange your own tasks; managers + dept admins can arrange
 *  their team's. */
async function assertCanEdit(actor: SessionUser, ownerId: string) {
  if (ownerId === actor.sub || isManager(actor.role)) return;
  const owner = await getUserById(ownerId);
  if (!owner || !canManageDept(actor, owner.department)) throw new Error("You can only change your own tasks.");
}

export async function moveTaskAction(input: { id: string; to: Column; date?: string }): Promise<Res> {
  try {
    const u = await requireUser();
    const t = (await allRows("Tasks")).find((r) => r.id === input.id);
    if (!t) return { ok: false, error: "Task not found." };
    await assertCanEdit(u, t.userId);
    const { date, status } = target(input.to, input.date || todayStr());
    await moveTask(input.id, date, status);
    revalidatePath("/board");
    revalidatePath("/updates");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return actionError(e);
  }
}

export async function addBoardTaskAction(input: { content: string; column: Column; forUserId?: string; date?: string }): Promise<Res<string>> {
  try {
    const u = await requireUser();
    const ownerId = input.forUserId || u.sub;
    await assertCanEdit(u, ownerId);
    const content = (input.content || "").trim();
    if (!content) return { ok: false, error: "Type the task first." };
    const { date } = target(input.column, input.date || todayStr());
    const id = await createTask({ userId: ownerId, date, content, createdBy: u.sub });
    // createTask defaults status to pending; a card added straight to Doing/Done
    // is rare, so we keep it in To-do / Backlog, which is the sensible default.
    await logAction(u, "Board", "Added task", content.slice(0, 80));
    revalidatePath("/board");
    revalidatePath("/updates");
    return { ok: true, data: id, message: input.column === "backlog" ? "Added to backlog" : "Added" };
  } catch (e) {
    return actionError(e);
  }
}

export async function deleteBoardTaskAction(input: { id: string }): Promise<Res> {
  try {
    const u = await requireUser();
    const t = (await allRows("Tasks")).find((r) => r.id === input.id);
    if (!t) return { ok: true };
    await assertCanEdit(u, t.userId);
    await removeTask(input.id);
    revalidatePath("/board");
    revalidatePath("/updates");
    return { ok: true, message: "Removed" };
  } catch (e) {
    return actionError(e);
  }
}

/** Push a person's unfinished To-do / Doing cards for `date` to the next day. */
export async function carryOverAction(input: { date: string; forUserId?: string }): Promise<Res> {
  try {
    const u = await requireUser();
    const ownerId = input.forUserId || u.sub;
    await assertCanEdit(u, ownerId);
    const date = input.date || todayStr();
    const next = addDays(date, 1);
    const tops = (await allRows("Tasks")).filter(
      (t) => t.userId === ownerId && !t.parentId && t.date === date && t.status !== "done",
    );
    if (!tops.length) return { ok: false, error: "Nothing unfinished to carry over." };
    for (const t of tops) await moveTask(t.id, next, t.status === "in-progress" ? "in-progress" : "pending");
    await logAction(u, "Board", "Carried unfinished to next day", `${tops.length} → ${next}`);
    revalidatePath("/board");
    revalidatePath("/updates");
    return { ok: true, message: `Moved ${tops.length} unfinished task${tops.length === 1 ? "" : "s"} to ${next.slice(5).replace("-", "/")}` };
  } catch (e) {
    return actionError(e);
  }
}
