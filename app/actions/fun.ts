"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireAdmin } from "@/lib/dal";
import { getFunState, setFunEnabled, setFunTitle, addContribution } from "@/lib/fun";
import { actionError, type Res } from "@/lib/action";

export async function toggleFunAction(input: { on: boolean }): Promise<Res> {
  try {
    await requireAdmin();
    await setFunEnabled(input.on);
    revalidatePath("/fun");
    return { ok: true, message: input.on ? "Fun Zone opened 🎉" : "Fun Zone closed" };
  } catch (e) {
    return actionError(e);
  }
}

export async function setFunTitleAction(input: { title: string }): Promise<Res> {
  try {
    await requireAdmin();
    await setFunTitle(input.title.trim() || "Activity");
    revalidatePath("/fun");
    return { ok: true, message: "Saved" };
  } catch (e) {
    return actionError(e);
  }
}

export async function addContributionAction(input: { content: string }): Promise<Res> {
  try {
    const u = await requireUser();
    const st = await getFunState();
    if (!st.enabled) return { ok: false, error: "Fun Zone is closed right now." };
    if (!input.content.trim()) return { ok: false, error: "Write something first." };
    await addContribution(u.sub, input.content.trim());
    revalidatePath("/fun");
    return { ok: true, message: "Posted 🎉" };
  } catch (e) {
    return actionError(e);
  }
}
