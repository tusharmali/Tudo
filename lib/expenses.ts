import { allRows, appendRow, updateWhere, deleteWhere, genId } from "./db";

export type ExpenseStatus = "pending" | "approved" | "rejected" | "paid";
export const EXPENSE_CATEGORIES = ["Software", "Food & Drinks", "Travel", "Office", "Marketing", "Hardware", "Utilities", "Other"];

export interface Expense {
  id: string;
  userId: string;
  amount: string;
  category: string;
  note: string;
  date: string;
  receiptKey: string;
  status: ExpenseStatus;
  decidedBy: string;
  decidedAt: string;
  createdAt: string;
}

async function all(): Promise<Expense[]> {
  return (await allRows("Expenses")) as unknown as Expense[];
}

const byDate = (a: Expense, b: Expense) => (b.date || b.createdAt || "").localeCompare(a.date || a.createdAt || "");

export async function listAllExpenses(): Promise<Expense[]> {
  return (await all()).sort(byDate);
}
export async function listExpensesForUser(userId: string): Promise<Expense[]> {
  return (await all()).filter((e) => e.userId === userId).sort(byDate);
}
export async function getExpense(id: string): Promise<Expense | null> {
  return (await all()).find((e) => e.id === id) ?? null;
}

export async function addExpense(input: { userId: string; amount: number; category: string; note: string; date: string; receiptKey: string }): Promise<string> {
  const id = genId("exp");
  await appendRow("Expenses", {
    id,
    userId: input.userId,
    amount: input.amount.toFixed(2),
    category: input.category || "Other",
    note: input.note.trim().slice(0, 300),
    date: /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : new Date().toISOString().slice(0, 10),
    receiptKey: input.receiptKey || "",
    status: "pending",
    decidedBy: "",
    decidedAt: "",
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function decideExpense(id: string, status: ExpenseStatus, adminId: string): Promise<number> {
  return updateWhere("Expenses", (r) => r.id === id, { status, decidedBy: adminId, decidedAt: new Date().toISOString() });
}

export async function removeExpense(id: string): Promise<number> {
  return deleteWhere("Expenses", (r) => r.id === id);
}
