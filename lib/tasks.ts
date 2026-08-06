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
}): Promise<void> {
  const siblings = (await listByDate(input.date)).filter(
    (t) => t.userId === input.userId && (t.parentId || "") === (input.parentId || ""),
  );
  await appendRow("Tasks", {
    id: genId("tk"),
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
}

export async function setStatus(id: string, status: string): Promise<void> {
  await updateWhere("Tasks", (r) => r.id === id, { status });
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
