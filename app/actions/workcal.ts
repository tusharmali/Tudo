"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/dal";
import { setOverride } from "@/lib/workcal";
import { logAction } from "@/lib/audit";
import { actionError, type Res } from "@/lib/action";

export async function setWorkDayAction(input: { date: string; type: string; note: string }): Promise<Res> {
  try {
    const me = await requireManager();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { ok: false, error: "Bad date." };
    const type = input.type === "working" || input.type === "holiday" ? input.type : "";
    await setOverride(input.date, type, input.note || "", me.sub);
    await logAction(me, "Calendar", type ? `Marked ${input.date} ${type}` : `Cleared ${input.date}`, input.note || "");
    revalidatePath("/calendar");
    return { ok: true, message: type ? `Marked ${type}` : "Cleared" };
  } catch (e) {
    return actionError(e);
  }
}
