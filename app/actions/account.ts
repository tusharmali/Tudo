"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireManager } from "@/lib/dal";
import { setPassword, verifyAndSetPassword, getUserById, setName, setAvatar } from "@/lib/users";
import { putAvatar, deleteObject, storageReady } from "@/lib/storage";
import { assertCanModify } from "@/lib/owner";
import { logAction } from "@/lib/audit";
import { notifyIfEnabled } from "@/lib/notifications";
import { actionError, type Res } from "@/lib/action";

const IMG_MAX_BYTES = 300_000; // the client resizes to ~200px, so this is generous

export async function updateMyNameAction(input: { name: string }): Promise<Res> {
  try {
    const u = await requireUser();
    const clean = (input.name || "").trim();
    if (clean.length < 2) return { ok: false, error: "Enter your name (at least 2 characters)." };
    await setName(u.sub, clean);
    await logAction(u, "Account", "Updated their name", clean);
    revalidatePath("/account");
    return { ok: true, message: "Name updated ✓" };
  } catch (e) {
    return actionError(e);
  }
}

export async function updateMyAvatarAction(input: { dataUrl: string }): Promise<Res> {
  try {
    const u = await requireUser();
    const v = (input.dataUrl || "").trim();
    const me = await getUserById(u.sub);
    const oldKey = me?.avatar || "";

    // Empty payload → remove the photo (fall back to initials).
    if (!v) {
      await setAvatar(u.sub, "");
      await deleteObject(oldKey);
      await logAction(u, "Account", "Removed their photo", "");
      revalidatePath("/account");
      return { ok: true, message: "Photo removed" };
    }

    const m = /^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/i.exec(v);
    if (!m) return { ok: false, error: "That doesn't look like an image." };
    if (!storageReady()) return { ok: false, error: "Photo storage isn't set up yet." };

    const buf = Buffer.from(m[2], "base64");
    if (buf.length > IMG_MAX_BYTES) return { ok: false, error: "Image is too large — pick a smaller one." };

    const key = await putAvatar(u.sub, buf, m[1].toLowerCase());
    await setAvatar(u.sub, key);
    if (oldKey && oldKey !== key) await deleteObject(oldKey);
    await logAction(u, "Account", "Updated their photo", "");
    revalidatePath("/account");
    return { ok: true, message: "Photo updated ✓" };
  } catch (e) {
    return actionError(e);
  }
}

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
    await notifyIfEnabled("people.password", input.userId, "Password reset", `${me.name} reset your password — ask them for your new one to sign in.`, me.sub, "/account");
    return { ok: true, message: "Password reset ✓" };
  } catch (e) {
    return actionError(e);
  }
}
