"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { getUserById } from "@/lib/users";
import { giveKudo } from "@/lib/kudos";
import { actionError, type Res } from "@/lib/action";

export async function giveKudosAction(input: { toUserId: string; category: string; message: string }): Promise<Res> {
  try {
    const u = await requireUser();
    if (!input.toUserId) return { ok: false, error: "Pick a teammate." };
    if (input.toUserId === u.sub) return { ok: false, error: "You can't give kudos to yourself 😄" };
    if (!input.message.trim()) return { ok: false, error: "Add a short message." };
    const to = await getUserById(input.toUserId);
    if (!to) return { ok: false, error: "Teammate not found." };
    await giveKudo(u.sub, input.toUserId, input.category || "team-player", input.message.trim().slice(0, 500));
    revalidatePath("/kudos");
    revalidatePath("/dashboard");
    return { ok: true, message: `Kudos sent to ${to.name} 🎉` };
  } catch (e) {
    return actionError(e);
  }
}
