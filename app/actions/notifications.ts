"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireManager } from "@/lib/dal";
import { create, markRead, remove, clearAll } from "@/lib/notifications";
import { saveSubscription, sendToAll, sendToUsers } from "@/lib/push";
import { listUsers } from "@/lib/users";
import { actionError, type Res } from "@/lib/action";
import { logAction } from "@/lib/audit";

export async function pushBroadcastAction(input: { title: string; body: string; target?: string }): Promise<Res> {
  try {
    const admin = await requireManager();
    const title = input.title.trim();
    const body = input.body.trim();
    if (!title && !body) return { ok: false, error: "Add a title or a message." };

    const dept = input.target && input.target !== "all" ? input.target : "";
    let targetString = "all";
    let recipientIds: string[] = [];
    if (dept) {
      const users = await listUsers();
      recipientIds = users.filter((u) => u.department === dept && (u.status || "active") !== "suspended").map((u) => u.id);
      if (!recipientIds.length) return { ok: false, error: `No active members in ${dept}.` };
      targetString = recipientIds.join(",");
    }

    await create(title || "Announcement", body, targetString, admin.sub, "/dashboard");
    const payload = { title: title || "Tudo", body, url: "/dashboard" };
    if (dept) await sendToUsers(recipientIds, payload).catch(() => {});
    else await sendToAll(payload).catch(() => {});

    await logAction(admin, "Broadcast", "Sent broadcast", `${dept ? dept : "Everyone"}: ${(title || body).slice(0, 80)}`);
    revalidatePath("/broadcast");
    return { ok: true, message: dept ? `Broadcast sent to ${dept} 📣` : "Broadcast sent to everyone 📣" };
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
    const me = await requireManager();
    if (!input.id) return { ok: false, error: "Missing notification id." };
    const n = await remove(input.id);
    if (!n) return { ok: false, error: "Notification not found." };
    await logAction(me, "Broadcast", "Deleted a notification", "");
    revalidatePath("/broadcast");
    return { ok: true, message: "Notification deleted" };
  } catch (e) {
    return actionError(e);
  }
}

export async function clearAllNotificationsAction(): Promise<Res> {
  try {
    const me = await requireManager();
    const n = await clearAll();
    await logAction(me, "Broadcast", "Cleared all notifications", `${n} removed`);
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
