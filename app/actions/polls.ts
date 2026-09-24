"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireManager } from "@/lib/dal";
import { createPoll, getPoll, vote, closePoll, removePoll, pollIsOpen, canSeePoll } from "@/lib/polls";
import { create as createNotification } from "@/lib/notifications";
import { sendToAll, sendToUsers } from "@/lib/push";
import { listUsers } from "@/lib/users";
import { isManager } from "@/lib/roles";
import { logAction } from "@/lib/audit";
import { actionError, type Res } from "@/lib/action";

export async function createPollAction(input: { question: string; options: string[]; target: string; closesAt: string }): Promise<Res<string>> {
  try {
    const me = await requireManager();
    if (!input.question.trim()) return { ok: false, error: "Ask a question." };
    const opts = input.options.map((o) => o.trim()).filter(Boolean);
    if (opts.length < 2) return { ok: false, error: "Add at least two options." };
    const closesAt = input.closesAt && !isNaN(new Date(input.closesAt).getTime()) ? new Date(input.closesAt).toISOString() : "";

    const id = await createPoll({ question: input.question, options: opts, target: input.target || "all", closesAt, createdBy: me.sub });

    // Notify the audience (bell + push).
    const title = `📊 Poll: ${input.question.trim().slice(0, 70)}`;
    const body = "Tap to respond on your dashboard.";
    if (input.target && input.target !== "all") {
      const ids = (await listUsers()).filter((u) => u.department === input.target && (u.status || "active") !== "suspended").map((u) => u.id);
      await createNotification(title, body, ids.join(","), me.sub, "/dashboard");
      await sendToUsers(ids, { title, body, url: "/dashboard" }).catch(() => {});
    } else {
      await createNotification(title, body, "all", me.sub, "/dashboard");
      await sendToAll({ title, body, url: "/dashboard" }).catch(() => {});
    }
    await logAction(me, "Broadcast", "Created a poll", `${input.target === "all" || !input.target ? "Everyone" : input.target}: ${input.question.trim().slice(0, 60)}`);
    revalidatePath("/broadcast");
    revalidatePath("/dashboard");
    return { ok: true, data: id, message: "Poll sent" };
  } catch (e) {
    return actionError(e);
  }
}

export async function votePollAction(input: { pollId: string; option: string }): Promise<Res> {
  try {
    const u = await requireUser();
    const poll = await getPoll(input.pollId);
    if (!poll) return { ok: false, error: "Poll not found." };
    if (!pollIsOpen(poll)) return { ok: false, error: "This poll has closed." };
    if (!canSeePoll(poll, { dept: u.dept })) return { ok: false, error: "This poll isn't for your department." };
    if (!poll.options.includes(input.option)) return { ok: false, error: "Unknown option." };
    await vote(poll.id, u.sub, input.option);
    revalidatePath("/dashboard");
    revalidatePath("/broadcast");
    return { ok: true, message: "Response recorded ✓" };
  } catch (e) {
    return actionError(e);
  }
}

async function assertPollAdmin(pollId: string) {
  const u = await requireUser();
  if (isManager(u.role)) return u;
  const poll = await getPoll(pollId);
  if (!poll || poll.createdBy !== u.sub) throw new Error("Only a manager or the poll's creator can do that.");
  return u;
}

export async function closePollAction(input: { pollId: string }): Promise<Res> {
  try {
    const me = await assertPollAdmin(input.pollId);
    await closePoll(input.pollId);
    await logAction(me, "Broadcast", "Closed a poll", input.pollId);
    revalidatePath("/broadcast");
    revalidatePath("/dashboard");
    return { ok: true, message: "Poll closed" };
  } catch (e) {
    return actionError(e);
  }
}

export async function deletePollAction(input: { pollId: string }): Promise<Res> {
  try {
    const me = await assertPollAdmin(input.pollId);
    await removePoll(input.pollId);
    await logAction(me, "Broadcast", "Deleted a poll", input.pollId);
    revalidatePath("/broadcast");
    revalidatePath("/dashboard");
    return { ok: true, message: "Poll deleted" };
  } catch (e) {
    return actionError(e);
  }
}
