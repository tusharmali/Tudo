"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireManager } from "@/lib/dal";
import { isMember, sendMessage, ensureDm, createGroup, getChat, membersOf } from "@/lib/chat";
import { getUserById } from "@/lib/users";
import { isManager } from "@/lib/roles";
import type { SessionUser } from "@/lib/types";
import { actionError, type Res } from "@/lib/action";

/** Employees may only message within their own department; managers, anyone. */
async function assertCanMessage(u: SessionUser, otherId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isManager(u.role)) return { ok: true };
  const other = await getUserById(otherId);
  if (!other) return { ok: false, error: "Teammate not found." };
  if (other.department !== u.dept) return { ok: false, error: "You can only message people in your department." };
  return { ok: true };
}

export async function sendMessageAction(input: { chatId: string; content: string }): Promise<Res> {
  try {
    const u = await requireUser();
    const text = input.content.trim();
    if (!text) return { ok: false, error: "Type a message." };
    if (!(await isMember(input.chatId, u.sub))) return { ok: false, error: "You're not in this chat." };
    // Block cross-department DMs for employees (defence in depth).
    if (!isManager(u.role)) {
      const chat = await getChat(input.chatId);
      if (chat?.type === "dm") {
        const otherId = membersOf(chat).find((id) => id !== u.sub);
        if (otherId) {
          const allowed = await assertCanMessage(u, otherId);
          if (!allowed.ok) return { ok: false, error: allowed.error };
        }
      }
    }
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
    const allowed = await assertCanMessage(u, input.otherId);
    if (!allowed.ok) return { ok: false, error: allowed.error };
    const id = await ensureDm(u.sub, input.otherId);
    revalidatePath("/chat");
    return { ok: true, data: id };
  } catch (e) {
    return actionError(e);
  }
}

export async function createGroupAction(input: { name: string; department: string; memberIds: string[] }): Promise<Res<string>> {
  try {
    const admin = await requireManager();
    if (!input.name.trim()) return { ok: false, error: "Give the group a name." };
    if (!input.memberIds?.length) return { ok: false, error: "Add at least one member." };
    const id = await createGroup(input.name.trim(), input.department, input.memberIds, admin.sub);
    revalidatePath("/chat");
    return { ok: true, data: id, message: "Group created" };
  } catch (e) {
    return actionError(e);
  }
}
