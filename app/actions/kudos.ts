"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { getUserById } from "@/lib/users";
import { isManager } from "@/lib/roles";
import { giveKudo, getKudo, removeKudo } from "@/lib/kudos";
import { actionError, type Res } from "@/lib/action";
import { logAction } from "@/lib/audit";

export async function giveKudosAction(input: { toUserId: string; category: string; message: string }): Promise<Res> {
  try {
    const u = await requireUser();
    if (!input.toUserId) return { ok: false, error: "Pick a teammate." };
    if (input.toUserId === u.sub) return { ok: false, error: "You can't give kudos to yourself 😄" };
    if (!input.message.trim()) return { ok: false, error: "Add a short message." };
    const to = await getUserById(input.toUserId);
    if (!to) return { ok: false, error: "Teammate not found." };
    if (!isManager(u.role) && to.department !== u.dept) {
      return { ok: false, error: "You can only give kudos within your department." };
    }
    await giveKudo(u.sub, input.toUserId, input.category || "team-player", input.message.trim().slice(0, 500));
    await logAction(u, "Kudos", "Gave kudos", `to ${to.name}`);
    revalidatePath("/kudos");
    revalidatePath("/dashboard");
    return { ok: true, message: `Kudos sent to ${to.name} 🎉` };
  } catch (e) {
    return actionError(e);
  }
}

export async function deleteKudoAction(input: { id: string }): Promise<Res> {
  try {
    const u = await requireUser();
    const k = await getKudo(input.id);
    if (!k) return { ok: false, error: "Kudo not found." };
    // The person who gave it can undo a mistake; managers can moderate any.
    if (k.fromUserId !== u.sub && !isManager(u.role)) {
      return { ok: false, error: "You can only remove a kudo you gave." };
    }
    await removeKudo(input.id);
    await logAction(u, "Kudos", "Removed a kudo", "");
    revalidatePath("/kudos");
    revalidatePath("/dashboard");
    return { ok: true, message: "Kudo removed" };
  } catch (e) {
    return actionError(e);
  }
}
