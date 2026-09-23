"use server";

import { requireUser, requireManager } from "@/lib/dal";
import { setPassword, verifyAndSetPassword, getUserById } from "@/lib/users";
import { assertCanModify } from "@/lib/owner";
import { logAction } from "@/lib/audit";
import { actionError, type Res } from "@/lib/action";

export async function changeMyPasswordAction(input: { current: string; next: string }): Promise<Res> {
  try {
    const u = await requireUser();
    if (!input.current) return { ok: false, error: "Enter your current password." };
    await verifyAndSetPassword(u.sub, input.current, input.next);
    return { ok: true, message: "Password updated ✓" };
  } catch (e) {
    return actionError(e);
  }
}

export async function resetPasswordAction(input: { userId: string; next: string }): Promise<Res> {
  try {
    const me = await requireManager();
    if (!input.userId) return { ok: false, error: "Pick a teammate." };
    await assertCanModify(input.userId, me.sub);
    await setPassword(input.userId, input.next);
    await logAction(me, "People", "Reset a password", (await getUserById(input.userId))?.name || input.userId);
    return { ok: true, message: "Password reset ✓" };
  } catch (e) {
    return actionError(e);
  }
}
