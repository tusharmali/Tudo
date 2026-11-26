import { allRows, appendRow, updateWhere, deleteWhere, genId, todayStr } from "./db";
import { getSetting, setSetting } from "./settings";

export interface Task {
  id: string;
  userId: string;
  date: string;
  parentId: string;
  content: string;
  order: string;
  status: string; // pending | in-progress | done
  updateText: string;
}

export interface TaskNode extends Task {
  children: Task[];
}

const byOrder = (a: Task, b: Task) => Number(a.order || 0) - Number(b.order || 0);

export async function listByDate(date = todayStr()): Promise<Task[]> {
  const rows = await allRows("Tasks");
  return rows.filter((r) => r.date === date) as unknown as Task[];
}

export async function listForUser(userId: string, date = todayStr()): Promise<Task[]> {
  return (await listByDate(date)).filter((t) => t.userId === userId);
}

export function toTree(tasks: Task[]): TaskNode[] {
  const tops = tasks.filter((t) => !t.parentId).sort(byOrder);
  return tops.map((t) => ({
    ...t,
    children: tasks.filter((c) => c.parentId === t.id).sort(byOrder),
  }));
}

export async function createTask(input: {
  userId: string;
  date: string;
  content: string;
  parentId?: string;
  createdBy: string;
}): Promise<string> {
  const siblings = (await listByDate(input.date)).filter(
    (t) => t.userId === input.userId && (t.parentId || "") === (input.parentId || ""),
  );
  const id = genId("tk");
  await appendRow("Tasks", {
    id,
    userId: input.userId,
    date: input.date,
    parentId: input.parentId || "",
    content: input.content,
    weekTarget: "",
    section: "",
    status: "pending",
    updateText: "",
    order: String(siblings.length),
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  });
  return id;
}

/** Persist a new sequence for a set of sibling tasks (order = position). */
export async function reorderTasks(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id, i) => updateWhere("Tasks", (r) => r.id === id, { order: String(i) })));
}

// ---------------- Work board ----------------
// The board reuses Tasks: a task with date "" is in the Backlog (unscheduled, so
// it never shows in a day plan); a task dated for a given day sits in To-do /
// Doing / Done by its status. Children ride along with their parent's date.

export interface BoardColumns {
  backlog: TaskNode[];
  todo: TaskNode[];
  doing: TaskNode[];
  done: TaskNode[];
}

/** Move a top-level task (and its children) to a board column. */
export async function moveTask(id: string, date: string, status: string): Promise<void> {
  await updateWhere("Tasks", (r) => r.id === id, { date, status });
  await updateWhere("Tasks", (r) => r.parentId === id, { date }); // children follow the date
}

/** The four board columns for one person on a given day. */
export async function boardFor(userId: string, date = todayStr()): Promise<BoardColumns> {
  const all = (await allRows("Tasks")).filter((r) => r.userId === userId) as unknown as Task[];
  const withKids = (t: Task): TaskNode => ({ ...t, children: all.filter((c) => c.parentId === t.id && (c.date || "") === (t.date || "")).sort(byOrder) });
  const tops = (pred: (t: Task) => boolean) => all.filter((t) => !t.parentId && pred(t)).sort(byOrder).map(withKids);
  return {
    backlog: tops((t) => (t.date || "") === ""),
    todo: tops((t) => t.date === date && t.status !== "in-progress" && t.status !== "done"),
    doing: tops((t) => t.date === date && t.status === "in-progress"),
    done: tops((t) => t.date === date && t.status === "done"),
  };
}

/** Lightweight per-person board tallies for the team view. */
export async function boardSummaries(userIds: string[], date = todayStr()): Promise<Record<string, { backlog: number; todo: number; doing: number; done: number; doingTitles: string[] }>> {
  const want = new Set(userIds);
  const all = (await allRows("Tasks")) as unknown as Task[];
  const out: Record<string, { backlog: number; todo: number; doing: number; done: number; doingTitles: string[] }> = {};
  for (const id of userIds) out[id] = { backlog: 0, todo: 0, doing: 0, done: 0, doingTitles: [] };
  for (const t of all) {
    if (t.parentId || !want.has(t.userId)) continue;
    const s = out[t.userId];
    if ((t.date || "") === "") s.backlog++;
    else if (t.date === date) {
      if (t.status === "done") s.done++;
      else if (t.status === "in-progress") { s.doing++; s.doingTitles.push(t.content); }
      else s.todo++;
    }
  }
  return out;
}

export async function setStatus(id: string, status: string): Promise<void> {
  await updateWhere("Tasks", (r) => r.id === id, { status });
}

export async function setContent(id: string, content: string): Promise<void> {
  await updateWhere("Tasks", (r) => r.id === id, { content: content.trim().slice(0, 300) });
}

export async function setUpdate(id: string, updateText: string): Promise<void> {
  await updateWhere("Tasks", (r) => r.id === id, { updateText });
}

export async function removeTask(id: string): Promise<void> {
  await deleteWhere("Tasks", (r) => r.id === id || r.parentId === id);
}

export async function getWeekTarget(userId: string): Promise<string> {
  return getSetting(`weektarget:${userId}`);
}

export async function setWeekTarget(userId: string, text: string): Promise<void> {
  await setSetting(`weektarget:${userId}`, text);
}
