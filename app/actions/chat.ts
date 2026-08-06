"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireAdmin } from "@/lib/dal";
import { isMember, sendMessage, ensureDm, createGroup } from "@/lib/chat";
import { actionError, type Res } from "@/lib/action";

export async function sendMessageAction(input: { chatId: string; content: string }): Promise<Res> {
  try {
    const u = await requireUser();
    const text = input.content.trim();
    if (!text) return { ok: false, error: "Type a message." };
    if (!(await isMember(input.chatId, u.sub))) return { ok: false, error: "You're not in this chat." };
    await sendMessage(input.chatId, u.sub, text.slice(0, 4000));
    revalidatePath("/chat");
    return { ok: true };
  } catch (e) {
    return actionError(e);
  }
}

export async function ensureDmAction(input: { otherId: string }): Promise<Res<string>> {
  try {
    const u = await requireUser();
    if (!input.otherId || input.otherId === u.sub) return { ok: false, error: "Pick someone to message." };
    const id = await ensureDm(u.sub, input.otherId);
    revalidatePath("/chat");
    return { ok: true, data: id };
  } catch (e) {
    return actionError(e);
  }
}

export async function createGroupAction(input: { name: string; department: string; memberIds: string[] }): Promise<Res<string>> {
  try {
    const admin = await requireAdmin();
    if (!input.name.trim()) return { ok: false, error: "Give the group a name." };
    if (!input.memberIds?.length) return { ok: false, error: "Add at least one member." };
    const id = await createGroup(input.name.trim(), input.department, input.memberIds, admin.sub);
    revalidatePath("/chat");
    return { ok: true, data: id, message: "Group created" };
  } catch (e) {
    return actionError(e);
  }
}
