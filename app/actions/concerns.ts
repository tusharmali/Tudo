"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { getUserById } from "@/lib/users";
import { createConcern, addReply, setStatus, listRelated } from "@/lib/concerns";
import { actionError, type Res } from "@/lib/action";

export async function createConcernAction(input: { toUserId: string; subject: string; message: string }): Promise<Res> {
  try {
    const u = await requireUser();
    if (!input.toUserId) return { ok: false, error: "Pick who to send it to." };
    if (!input.subject.trim() || !input.message.trim()) return { ok: false, error: "Add a subject and a message." };
    const to = await getUserById(input.toUserId);
    if (!to || to.role !== "superadmin") return { ok: false, error: "You can only send concerns to a super-admin." };
    await createConcern(u.sub, input.toUserId, input.subject.trim(), input.message.trim());
    revalidatePath("/concerns");
    return { ok: true, message: "Concern sent privately" };
  } catch (e) {
    return actionError(e);
  }
}

async function canAccess(concernId: string, userId: string) {
  const mine = await listRelated(userId);
  const c = mine.find((x) => x.id === concernId);
  if (!c) throw new Error("Concern not found.");
  return c;
}

export async function replyConcernAction(input: { concernId: string; message: string }): Promise<Res> {
  try {
    const u = await requireUser();
    if (!input.message.trim()) return { ok: false, error: "Type a reply." };
    await canAccess(input.concernId, u.sub);
    await addReply(input.concernId, u.sub, input.message.trim());
    revalidatePath("/concerns");
    return { ok: true, message: "Reply sent" };
  } catch (e) {
    return actionError(e);
  }
}

export async function resolveConcernAction(input: { concernId: string; resolved: boolean }): Promise<Res> {
  try {
    const u = await requireUser();
    await canAccess(input.concernId, u.sub);
    await setStatus(input.concernId, input.resolved ? "resolved" : "open");
    revalidatePath("/concerns");
    return { ok: true, message: input.resolved ? "Marked resolved" : "Reopened" };
  } catch (e) {
    return actionError(e);
  }
}
