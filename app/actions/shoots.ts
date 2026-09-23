"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { isManager } from "@/lib/roles";
import { createShoot, setShootStatus, removeShoot, SHOOT_STATUSES } from "@/lib/shoots";
import { actionError, type Res } from "@/lib/action";
import { logAction } from "@/lib/audit";
import type { SessionUser } from "@/lib/types";

const DIGI = "Digi";
function guard(u: SessionUser) {
  if (!isManager(u.role) && u.dept !== DIGI) throw new Error("Only the Digi team can manage shoots.");
}

export async function createShootAction(input: { client: string; title: string; date: string; assigneeId: string; notes: string }): Promise<Res> {
  try {
    const u = await requireUser();
    guard(u);
    if (!input.client?.trim() && !input.title?.trim()) return { ok: false, error: "Add a client or a title." };
    await createShoot({ client: input.client || "", title: input.title || "", date: input.date || "", assigneeId: input.assigneeId || "", notes: input.notes || "", createdBy: u.sub });
    await logAction(u, "Shoots", "Added a shoot", `${input.client || input.title}`.slice(0, 80));
    revalidatePath("/shoots");
    return { ok: true, message: "Shoot added" };
  } catch (e) {
    return actionError(e);
  }
}

export async function setShootStatusAction(input: { id: string; status: string }): Promise<Res> {
  try {
    const u = await requireUser();
    guard(u);
    await setShootStatus(input.id, (SHOOT_STATUSES as readonly string[]).includes(input.status) ? input.status : "planned");
    revalidatePath("/shoots");
    return { ok: true };
  } catch (e) {
    return actionError(e);
  }
}

export async function deleteShootAction(input: { id: string }): Promise<Res> {
  try {
    const u = await requireUser();
    guard(u);
    await removeShoot(input.id);
    await logAction(u, "Shoots", "Removed a shoot", "");
    revalidatePath("/shoots");
    return { ok: true, message: "Removed" };
  } catch (e) {
    return actionError(e);
  }
}
