"use server";

import { requireUser, requireManager } from "@/lib/dal";
import { setPassword, verifyAndSetPassword } from "@/lib/users";
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
    await requireManager();
    if (!input.userId) return { ok: false, error: "Pick a teammate." };
    await setPassword(input.userId, input.next);
    return { ok: true, message: "Password reset ✓" };
  } catch (e) {
    return actionError(e);
  }
}
