"use server";

import { revalidatePath } from "next/cache";
import { requireDayPlanEditor } from "@/lib/dal";
import { isManager, canManageDept, manageDeptsOf } from "@/lib/roles";
import { allRows, appendRows, deleteWhere, genId, todayStr } from "@/lib/db";
import { listUsers, getUserById } from "@/lib/users";
import { draftNextDayPlan, aiEnabled } from "@/lib/ai";
import { logAction } from "@/lib/audit";
import { actionError, type Res } from "@/lib/action";
import type { SessionUser } from "@/lib/types";

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00+05:30`);
  d.setDate(d.getDate() + n);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export type DraftPlan = { userId: string; name: string; handle: string; dept: string; targets: string[]; note: string; source: "ai" | "carry" };
export type DraftResult = { date: string; aiUsed: boolean; plans: DraftPlan[] };

async function scopeUsers(me: SessionUser) {
  const users = await listUsers();
  const list = isManager(me.role) ? users : users.filter((u) => manageDeptsOf(me).includes(u.department));
  return list.filter((u) => (u.status || "active") !== "suspended");
}

export async function draftPlanAction(input: { baseDate?: string }): Promise<Res<DraftResult>> {
  try {
    const me = await requireDayPlanEditor();
    const base = input.baseDate || todayStr();
    const target = addDays(base, 1);
    const users = await scopeUsers(me);
    const byId = new Map(users.map((u) => [u.id, u]));
    const tasks = (await allRows("Tasks")).filter((t) => !t.parentId && byId.has(t.userId));

    // Per-person buckets from the base day + backlog.
    type Bucket = { done: string[]; open: string[]; backlog: string[] };
    const buckets = new Map<string, Bucket>();
    for (const u of users) buckets.set(u.id, { done: [], open: [], backlog: [] });
    for (const t of tasks) {
      const b = buckets.get(t.userId)!;
      if ((t.date || "") === "") b.backlog.push(t.content);
      else if (t.date === base) (t.status === "done" ? b.done : b.open).push(t.content);
    }

    // Only plan for people who have unfinished work or a backlog.
    const relevant = users.filter((u) => { const b = buckets.get(u.id)!; return b.open.length || b.backlog.length; });

    // Deterministic fallback draft: carry the unfinished work forward.
    const fallback = new Map<string, string[]>();
    for (const u of relevant) fallback.set(u.id, buckets.get(u.id)!.open.slice(0, 8));

    // Ask the AI to refine (best-effort — we fall back if it fails/parses wrong).
    let aiPlans: Record<string, { targets: string[]; note: string }> = {};
    let aiUsed = false;
    if (aiEnabled() && relevant.length) {
      const stateText = relevant.map((u) => {
        const b = buckets.get(u.id)!;
        return `@${u.handle} (${u.name}):\n  done: ${b.done.join("; ") || "none"}\n  unfinished: ${b.open.join("; ") || "none"}\n  backlog: ${b.backlog.join("; ") || "none"}`;
      }).join("\n\n");
      try {
        const raw = await draftNextDayPlan(stateText);
        const m = raw.match(/\{[\s\S]*\}/);
        const parsed = m ? JSON.parse(m[0]) : null;
        const arr: { handle?: string; targets?: unknown; note?: unknown }[] = parsed?.plans;
        if (Array.isArray(arr)) {
          const handleToId = new Map(relevant.map((u) => [u.handle.toLowerCase(), u.id]));
          for (const p of arr) {
            const id = handleToId.get(String(p.handle || "").replace(/^@/, "").toLowerCase());
            if (!id) continue;
            const targets = Array.isArray(p.targets) ? (p.targets as unknown[]).map((x) => String(x).trim().slice(0, 200)).filter(Boolean).slice(0, 8) : [];
            if (targets.length) { aiPlans[id] = { targets, note: String(p.note || "").slice(0, 160) }; aiUsed = true; }
          }
        }
      } catch { /* keep fallback */ }
    }

    const plans: DraftPlan[] = relevant.map((u) => {
      const ai = aiPlans[u.id];
      return {
        userId: u.id, name: u.name, handle: u.handle, dept: u.department || "—",
        targets: ai?.targets?.length ? ai.targets : (fallback.get(u.id) || []),
        note: ai?.note || "",
        source: (ai?.targets?.length ? "ai" : "carry") as "ai" | "carry",
      };
    }).filter((p) => p.targets.length);

    return { ok: true, data: { date: target, aiUsed, plans } };
  } catch (e) {
    return actionError(e);
  }
}

export async function approvePlanAction(input: { date: string; plans: { userId: string; targets: string[] }[] }): Promise<Res> {
  try {
    const me = await requireDayPlanEditor();
    const date = input.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Bad date." };
    let created = 0, people = 0;
    const now = new Date().toISOString();
    for (const p of input.plans) {
      const owner = await getUserById(p.userId);
      if (!owner) continue;
      if (!isManager(me.role) && !canManageDept(me, owner.department)) continue; // skip out-of-scope silently
      const targets = (p.targets || []).map((t) => t.trim()).filter(Boolean).slice(0, 12);
      if (!targets.length) continue;
      // Replace any existing plan for that day (idempotent re-approve).
      await deleteWhere("Tasks", (r) => r.userId === p.userId && r.date === date);
      const rows = targets.map((content, i) => ({
        id: genId("tk"), userId: p.userId, date, parentId: "", content, weekTarget: "", section: "",
        status: "pending", updateText: "", order: String(i), createdBy: me.sub, createdAt: now,
      }));
      await appendRows("Tasks", rows);
      created += rows.length; people += 1;
    }
    await logAction(me, "Day plan", "Approved AI next-day plan", `${created} tasks · ${people} people · ${date}`);
    revalidatePath("/board");
    revalidatePath("/updates");
    return { ok: true, message: `Set ${created} task${created === 1 ? "" : "s"} for ${people} teammate${people === 1 ? "" : "s"} on ${date.slice(5).replace("-", "/")}` };
  } catch (e) {
    return actionError(e);
  }
}
