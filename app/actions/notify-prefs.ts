"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/dal";
import { setNotifyEnabled, isNotifyKey } from "@/lib/notify-prefs";
import { logAction } from "@/lib/audit";
import { actionError, type Res } from "@/lib/action";

export async function setNotifyPrefAction(input: { key: string; on: boolean }): Promise<Res> {
  try {
    const me = await requireManager();
    if (!isNotifyKey(input.key)) return { ok: false, error: "Unknown notification." };
    await setNotifyEnabled(input.key, input.on);
    await logAction(me, "Settings", input.on ? "Turned a notification on" : "Muted a notification", input.key);
    revalidatePath("/logs");
    return { ok: true, message: input.on ? "Notification on" : "Notification muted" };
  } catch (e) {
    return actionError(e);
  }
}
