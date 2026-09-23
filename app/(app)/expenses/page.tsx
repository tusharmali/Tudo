import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { listAllExpenses, EXPENSE_CATEGORIES } from "@/lib/expenses";
import { usersMap } from "@/lib/users";
import { todayStr } from "@/lib/db";
import ExpensesClient from "./ExpensesClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Expenses" };

export default async function ExpensesPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!isManager(user.role)) redirect("/dashboard"); // managers only — internal
  const [rows, umap] = await Promise.all([listAllExpenses(), usersMap()]);
  const expenses = rows.map((e) => ({
    id: e.id,
    userId: e.userId,
    name: umap[e.userId]?.name || "Someone",
    dept: umap[e.userId]?.department || "",
    amount: e.amount,
    category: e.category,
    note: e.note,
    date: e.date,
    hasReceipt: !!e.receiptKey,
    status: e.status,
  }));
  return <ExpensesClient me={user.sub} isManager expenses={expenses} categories={EXPENSE_CATEGORIES} today={todayStr()} />;
}
