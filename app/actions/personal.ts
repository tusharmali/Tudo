"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { addTask, setTaskDone, removeTask, addBookmark, removeBookmark, setNotes } from "@/lib/personal";
import { actionError, type Res } from "@/lib/action";

export async function saveNotesAction(input: { text: string }): Promise<Res> {
  try {
    const u = await requireUser();
    await setNotes(u.sub, input.text || "");
    return { ok: true };
  } catch (e) {
    return actionError(e);
  }
}

export async function addPersonalTaskAction(input: { text: string; due: string }): Promise<Res> {
  try {
    const u = await requireUser();
    if (!input.text.trim()) return { ok: false, error: "Type your reminder first." };
    await addTask(u.sub, input.text, input.due || "");
    revalidatePath("/my");
    return { ok: true, message: "Reminder added" };
  } catch (e) {
    return actionError(e);
  }
}

export async function togglePersonalTaskAction(input: { id: string; done: boolean }): Promise<Res> {
  try {
    const u = await requireUser();
    await setTaskDone(input.id, u.sub, input.done);
    revalidatePath("/my");
    return { ok: true };
  } catch (e) {
    return actionError(e);
  }
}

export async function removePersonalTaskAction(input: { id: string }): Promise<Res> {
  try {
    const u = await requireUser();
    await removeTask(input.id, u.sub);
    revalidatePath("/my");
    return { ok: true, message: "Removed" };
  } catch (e) {
    return actionError(e);
  }
}

export async function addBookmarkAction(input: { title: string; url: string; note: string }): Promise<Res> {
  try {
    const u = await requireUser();
    if (!input.title.trim() && !input.url.trim()) return { ok: false, error: "Add a title or a link." };
    await addBookmark(u.sub, input.title, input.url, input.note || "");
    revalidatePath("/my");
    return { ok: true, message: "Bookmark saved" };
  } catch (e) {
    return actionError(e);
  }
}

export async function removeBookmarkAction(input: { id: string }): Promise<Res> {
  try {
    const u = await requireUser();
    await removeBookmark(input.id, u.sub);
    revalidatePath("/my");
    return { ok: true, message: "Removed" };
  } catch (e) {
    return actionError(e);
  }
}
