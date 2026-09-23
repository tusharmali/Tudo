"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireManager } from "@/lib/dal";
import { addExpense, decideExpense, getExpense, removeExpense, type ExpenseStatus } from "@/lib/expenses";
import { putBytes, deleteObject, storageReady } from "@/lib/storage";
import { getUserById } from "@/lib/users";
import { isManager } from "@/lib/roles";
import { notifyUser } from "@/lib/notifications";
import { logAction } from "@/lib/audit";
import { genId } from "@/lib/db";
import { actionError, type Res } from "@/lib/action";

const RECEIPT_MAX = 3_000_000; // ~3 MB decoded

export async function submitExpenseAction(input: { amount: string; category: string; note: string; date: string; receipt?: string }): Promise<Res> {
  try {
    const u = await requireUser();
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter a valid amount." };

    let receiptKey = "";
    const v = (input.receipt || "").trim();
    if (v) {
      const m = /^data:(image\/(?:png|jpe?g|webp)|application\/pdf);base64,(.+)$/i.exec(v);
      if (!m) return { ok: false, error: "Receipt must be an image or PDF." };
      if (!storageReady()) return { ok: false, error: "File storage isn't set up yet." };
      const buf = Buffer.from(m[2], "base64");
      if (buf.length > RECEIPT_MAX) return { ok: false, error: "Receipt is too large (max 3 MB)." };
      const ext = m[1].includes("pdf") ? "pdf" : m[1].includes("png") ? "png" : m[1].includes("webp") ? "webp" : "jpg";
      receiptKey = await putBytes(`receipts/${genId("rc")}.${ext}`, buf, m[1].toLowerCase());
    }

    await addExpense({ userId: u.sub, amount, category: input.category, note: input.note || "", date: input.date, receiptKey });
    await logAction(u, "Expenses", "Submitted an expense", `₹${amount.toFixed(2)} · ${input.category || "Other"}`);
    revalidatePath("/expenses");
    return { ok: true, message: "Expense submitted for approval" };
  } catch (e) {
    return actionError(e);
  }
}

export async function decideExpenseAction(input: { id: string; status: ExpenseStatus }): Promise<Res> {
  try {
    const me = await requireManager();
    const exp = await getExpense(input.id);
    if (!exp) return { ok: false, error: "Expense not found." };
    if (!["approved", "rejected", "paid"].includes(input.status)) return { ok: false, error: "Unknown status." };
    await decideExpense(input.id, input.status, me.sub);
    await logAction(me, "Expenses", `Marked expense ${input.status}`, `${(await getUserById(exp.userId))?.name || exp.userId} · ₹${exp.amount}`);
    const label = input.status === "approved" ? "approved ✅" : input.status === "rejected" ? "rejected" : "marked paid 💸";
    await notifyUser(exp.userId, `Expense ${label}`, `Your ₹${exp.amount} ${exp.category} expense was ${input.status} by ${me.name}.`, me.sub, "/expenses");
    revalidatePath("/expenses");
    return { ok: true, message: `Expense ${input.status}` };
  } catch (e) {
    return actionError(e);
  }
}

export async function deleteExpenseAction(input: { id: string }): Promise<Res> {
  try {
    const u = await requireUser();
    const exp = await getExpense(input.id);
    if (!exp) return { ok: false, error: "Expense not found." };
    // Owner may delete their own while pending; managers may delete any.
    if (!(isManager(u.role) || (exp.userId === u.sub && exp.status === "pending"))) {
      return { ok: false, error: "You can only remove your own pending expense." };
    }
    await removeExpense(input.id);
    if (exp.receiptKey) await deleteObject(exp.receiptKey);
    await logAction(u, "Expenses", "Removed an expense", `₹${exp.amount}`);
    revalidatePath("/expenses");
    return { ok: true, message: "Removed" };
  } catch (e) {
    return actionError(e);
  }
}
