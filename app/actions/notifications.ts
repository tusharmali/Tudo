"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireAdmin } from "@/lib/dal";
import { create, markRead, remove, clearAll } from "@/lib/notifications";
import { saveSubscription, sendToAll } from "@/lib/push";
import { actionError, type Res } from "@/lib/action";

export async function pushBroadcastAction(input: { title: string; body: string }): Promise<Res> {
  try {
    const admin = await requireAdmin();
    const title = input.title.trim();
    const body = input.body.trim();
    if (!title && !body) return { ok: false, error: "Add a title or a message." };
    await create(title || "Announcement", body, "all", admin.sub);
    await sendToAll({ title: title || "Tudo", body, url: "/dashboard" }).catch(() => {});
    revalidatePath("/broadcast");
    return { ok: true, message: "Broadcast sent to everyone 📣" };
  } catch (e) {
    return actionError(e);
  }
}

export async function markNotificationsReadAction(): Promise<Res> {
  try {
    const u = await requireUser();
    await markRead(u.sub);
    return { ok: true };
  } catch (e) {
    return actionError(e);
  }
}

export async function deleteNotificationAction(input: { id: string }): Promise<Res> {
  try {
    await requireAdmin();
    if (!input.id) return { ok: false, error: "Missing notification id." };
    const n = await remove(input.id);
    if (!n) return { ok: false, error: "Notification not found." };
    revalidatePath("/broadcast");
    return { ok: true, message: "Notification deleted" };
  } catch (e) {
    return actionError(e);
  }
}

export async function clearAllNotificationsAction(): Promise<Res> {
  try {
    await requireAdmin();
    const n = await clearAll();
    revalidatePath("/broadcast");
    return { ok: true, message: n ? `Cleared ${n} notification${n === 1 ? "" : "s"}` : "Nothing to clear" };
  } catch (e) {
    return actionError(e);
  }
}

export async function savePushSubscriptionAction(input: { subscription: unknown }): Promise<Res> {
  try {
    const u = await requireUser();
    const sub = input.subscription as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      return { ok: false, error: "Invalid subscription." };
    }
    await saveSubscription(u.sub, { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
    return { ok: true, message: "Notifications enabled on this device" };
  } catch (e) {
    return actionError(e);
  }
}
