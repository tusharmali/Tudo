import { allRows, appendRow, updateWhere, deleteWhere, genId } from "./db";

export interface Milestone {
  id: string;
  userId: string;
  title: string;
  targetDate: string;
  status: string;
  notes: string;
  createdBy: string;
  createdAt: string;
}

export const MILESTONE_STATUSES = ["pending", "in-progress", "done"] as const;

export async function listAllMilestones(): Promise<Milestone[]> {
  return ((await allRows("Milestones")) as unknown as Milestone[]).sort((a, b) => (a.targetDate || "9999").localeCompare(b.targetDate || "9999"));
}

export async function getMilestone(id: string): Promise<Milestone | null> {
  return (await listAllMilestones()).find((m) => m.id === id) ?? null;
}

export async function createMilestone(input: { userId: string; title: string; targetDate: string; notes: string; createdBy: string }): Promise<void> {
  await appendRow("Milestones", {
    id: genId("ms"),
    userId: input.userId,
    title: input.title.trim(),
    targetDate: input.targetDate || "",
    status: "pending",
    notes: input.notes.trim(),
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  });
}

export async function setMilestoneStatus(id: string, status: string): Promise<void> {
  await updateWhere("Milestones", (r) => r.id === id, { status });
}

export async function removeMilestone(id: string): Promise<void> {
  await deleteWhere("Milestones", (r) => r.id === id);
}
