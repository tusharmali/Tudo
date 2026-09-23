"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireManager } from "@/lib/dal";
import {
  sendMessage,
  ensureDm,
  createGroup,
  getChat,
  membersOf,
  renameGroup,
  setGroupMembers,
  toggleReaction,
  markChatRead,
  setChatMuted,
  getMessage,
} from "@/lib/chat";
import { getSettings } from "@/lib/settings";
import { getUserById } from "@/lib/users";
import { isManager } from "@/lib/roles";
import { notifyIfEnabled } from "@/lib/notifications";
import type { SessionUser } from "@/lib/types";
import { actionError, type Res } from "@/lib/action";

/** Employees may message within their own department, plus any manager
 *  (director / super-admin / HR). Managers may message anyone. */
async function assertCanMessage(u: SessionUser, otherId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isManager(u.role)) return { ok: true };
  const other = await getUserById(otherId);
  if (!other) return { ok: false, error: "Teammate not found." };
  if (other.department === u.dept || isManager(other.role)) return { ok: true };
  return { ok: false, error: "You can only message your department or a manager." };
}

export async function sendMessageAction(input: { chatId: string; content: string }): Promise<Res> {
  try {
    const u = await requireUser();
    const text = input.content.trim();
    if (!text) return { ok: false, error: "Type a message." };
    const chat = await getChat(input.chatId);
    if (!chat || !membersOf(chat).includes(u.sub)) return { ok: false, error: "You're not in this chat." };
    // Block cross-department DMs for employees (defence in depth).
    if (!isManager(u.role) && chat.type === "dm") {
      const otherId = membersOf(chat).find((id) => id !== u.sub);
      if (otherId) {
        const allowed = await assertCanMessage(u, otherId);
        if (!allowed.ok) return { ok: false, error: allowed.error };
      }
    }
    await sendMessage(input.chatId, u.sub, text.slice(0, 4000));

    // Ping every other member (bell + push) — unless they've muted this chat.
    const title = chat.type === "dm" ? `${u.name} messaged you` : `${u.name} · ${chat.name || "group"}`;
    const body = text.slice(0, 140);
    const settings = await getSettings();
    const url = `/chat?c=${chat.id}`;
    for (const id of membersOf(chat).filter((m) => m !== u.sub)) {
      const muted = (settings[`chatmute:${id}`] || "").split(",").map((s) => s.trim()).includes(chat.id);
      if (muted) continue;
      await notifyIfEnabled("chat.message", id, title, body, u.sub, url);
    }

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

/** Only the group's creator or a manager may edit it. */
async function assertCanEditGroup(u: SessionUser, chatId: string) {
  const chat = await getChat(chatId);
  if (!chat || chat.type !== "group") throw new Error("Group not found.");
  if (!(isManager(u.role) || chat.createdBy === u.sub)) throw new Error("Only the group's creator or a manager can edit it.");
  return chat;
}

export async function renameGroupAction(input: { chatId: string; name: string }): Promise<Res> {
  try {
    const u = await requireUser();
    const chat = await assertCanEditGroup(u, input.chatId);
    if (!input.name.trim()) return { ok: false, error: "Give the group a name." };
    await renameGroup(chat.id, input.name);
    revalidatePath("/chat");
    return { ok: true, message: "Group renamed" };
  } catch (e) {
    return actionError(e);
  }
}

export async function updateGroupMembersAction(input: { chatId: string; memberIds: string[] }): Promise<Res> {
  try {
    const u = await requireUser();
    const chat = await assertCanEditGroup(u, input.chatId);
    if (!input.memberIds?.length) return { ok: false, error: "A group needs at least one member." };
    await setGroupMembers(chat.id, input.memberIds, chat.createdBy);
    revalidatePath("/chat");
    return { ok: true, message: "Members updated" };
  } catch (e) {
    return actionError(e);
  }
}

export async function setChatMutedAction(input: { chatId: string; muted: boolean }): Promise<Res> {
  try {
    const u = await requireUser();
    const chat = await getChat(input.chatId);
    if (!chat || !membersOf(chat).includes(u.sub)) return { ok: false, error: "You're not in this chat." };
    await setChatMuted(u.sub, input.chatId, input.muted);
    return { ok: true, message: input.muted ? "Muted" : "Unmuted" };
  } catch (e) {
    return actionError(e);
  }
}

export async function reactMessageAction(input: { messageId: string; emoji: string }): Promise<Res> {
  try {
    const u = await requireUser();
    const msg = await getMessage(input.messageId);
    if (!msg) return { ok: false, error: "Message not found." };
    const chat = await getChat(msg.chatId);
    if (!chat || !membersOf(chat).includes(u.sub)) return { ok: false, error: "You're not in this chat." };
    const emoji = (input.emoji || "").slice(0, 8);
    if (!emoji) return { ok: false, error: "Pick an emoji." };
    await toggleReaction(input.messageId, u.sub, emoji);
    return { ok: true };
  } catch (e) {
    return actionError(e);
  }
}

export async function markChatReadAction(input: { chatId: string }): Promise<Res> {
  try {
    const u = await requireUser();
    if (input.chatId) await markChatRead(u.sub, input.chatId);
    return { ok: true };
  } catch (e) {
    return actionError(e);
  }
}
