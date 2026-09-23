import { allRows, appendRow, updateWhere, deleteWhere, genId } from "./db";

export interface Shoot {
  id: string;
  client: string;
  title: string;
  date: string;
  status: string;
  assigneeId: string;
  notes: string;
  createdBy: string;
  createdAt: string;
}

export const SHOOT_STATUSES = ["planned", "in-progress", "delivered"] as const;

export async function listShoots(): Promise<Shoot[]> {
  return ((await allRows("Shoots")) as unknown as Shoot[]).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}

export async function createShoot(input: {
  client: string;
  title: string;
  date: string;
  assigneeId: string;
  notes: string;
  createdBy: string;
}): Promise<void> {
  await appendRow("Shoots", {
    id: genId("sh"),
    client: input.client.trim(),
    title: input.title.trim(),
    date: input.date || "",
    status: "planned",
    assigneeId: input.assigneeId || "",
    notes: input.notes.trim(),
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  });
}

export async function setShootStatus(id: string, status: string): Promise<void> {
  await updateWhere("Shoots", (r) => r.id === id, { status });
}

export async function removeShoot(id: string): Promise<void> {
  await deleteWhere("Shoots", (r) => r.id === id);
}
