"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/dal";
import { createRelease, updateReleaseStatus, deleteRelease } from "@/lib/releases";
import { actionError, type Res } from "@/lib/action";

export async function createReleaseAction(input: {
  title: string;
  scheduledDate: string;
  points: string;
  resources: string;
  status: string;
}): Promise<Res> {
  try {
    await requireAdmin();
    if (!input.title.trim() || !input.scheduledDate) return { ok: false, error: "Add a title and a date." };
    await createRelease({
      title: input.title.trim(),
      scheduledDate: input.scheduledDate,
      points: input.points || "",
      resources: input.resources || "",
      status: input.status || "scheduled",
    });
    revalidatePath("/releases");
    return { ok: true, message: "Release added" };
  } catch (e) {
    return actionError(e);
  }
}

export async function updateReleaseStatusAction(input: { id: string; status: string }): Promise<Res> {
  try {
    await requireAdmin();
    await updateReleaseStatus(input.id, input.status);
    revalidatePath("/releases");
    return { ok: true, message: "Updated" };
  } catch (e) {
    return actionError(e);
  }
}

export async function deleteReleaseAction(input: { id: string }): Promise<Res> {
  try {
    await requireAdmin();
    await deleteRelease(input.id);
    revalidatePath("/releases");
    return { ok: true, message: "Removed" };
  } catch (e) {
    return actionError(e);
  }
}
