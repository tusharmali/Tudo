"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { isManager } from "@/lib/roles";
import { createMilestone, setMilestoneStatus, removeMilestone, getMilestone, MILESTONE_STATUSES } from "@/lib/milestones";
import { actionError, type Res } from "@/lib/action";
import type { SessionUser } from "@/lib/types";

const SUPPORT = "Support";
function canUse(u: SessionUser) {
  return isManager(u.role) || u.dept === SUPPORT;
}

export async function createMilestoneAction(input: { title: string; targetDate: string; notes: string }): Promise<Res> {
  try {
    const u = await requireUser();
    if (!canUse(u)) throw new Error("Only the Support team can add milestones.");
    if (!input.title?.trim()) return { ok: false, error: "Add a milestone title." };
    await createMilestone({ userId: u.sub, title: input.title, targetDate: input.targetDate || "", notes: input.notes || "", createdBy: u.sub });
    revalidatePath("/milestones");
    return { ok: true, message: "Milestone added" };
  } catch (e) {
    return actionError(e);
  }
}

async function ownOrManager(id: string, u: SessionUser) {
  const m = await getMilestone(id);
  if (!m) throw new Error("Milestone not found.");
  if (m.userId !== u.sub && !isManager(u.role)) throw new Error("That's not your milestone.");
  return m;
}

export async function setMilestoneStatusAction(input: { id: string; status: string }): Promise<Res> {
  try {
    const u = await requireUser();
    await ownOrManager(input.id, u);
    await setMilestoneStatus(input.id, (MILESTONE_STATUSES as readonly string[]).includes(input.status) ? input.status : "pending");
    revalidatePath("/milestones");
    return { ok: true };
  } catch (e) {
    return actionError(e);
  }
}

export async function deleteMilestoneAction(input: { id: string }): Promise<Res> {
  try {
    const u = await requireUser();
    await ownOrManager(input.id, u);
    await removeMilestone(input.id);
    revalidatePath("/milestones");
    return { ok: true, message: "Removed" };
  } catch (e) {
    return actionError(e);
  }
}
