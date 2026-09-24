"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { startBreak, endBreak } from "@/lib/breaks";
import { getToday } from "@/lib/attendance";
import { logAction } from "@/lib/audit";
import { actionError, type Res } from "@/lib/action";

/** Start a break — only while you're on shift (checked in, not checked out). */
export async function startBreakAction(input?: { note?: string }): Promise<Res> {
  try {
    const u = await requireUser();
    const att = await getToday(u.sub);
    if (!att?.checkIn) return { ok: false, error: "Check in first to start a break." };
    if (att.checkOut) return { ok: false, error: "You've already checked out for the day." };
    const r = await startBreak(u.sub, input?.note || "");
    if (!r.ok) return { ok: false, error: r.error };
    await logAction(u, "Attendance", "Started a break", input?.note || "");
    revalidatePath("/dashboard");
    revalidatePath("/attendance");
    revalidatePath("/team");
    return { ok: true, message: "Break started — enjoy ☕" };
  } catch (e) {
    return actionError(e);
  }
}

/** End the break you're currently on. */
export async function endBreakAction(): Promise<Res> {
  try {
    const u = await requireUser();
    const r = await endBreak(u.sub);
    if (!r.ok) return { ok: false, error: r.error };
    await logAction(u, "Attendance", "Ended a break", `${r.min} min`);
    revalidatePath("/dashboard");
    revalidatePath("/attendance");
    revalidatePath("/team");
    const mins = r.min ?? 0;
    const pretty = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
    return { ok: true, message: `Welcome back — break was ${pretty}` };
  } catch (e) {
    return actionError(e);
  }
}
