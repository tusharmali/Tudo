import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { listAllExpenses } from "@/lib/expenses";
import { usersMap } from "@/lib/users";

export const dynamic = "force-dynamic";

function cell(v: string): string {
  const s = (v ?? "").toString();
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV export of all expenses — opens in Excel. Managers/HR only. */
export async function GET() {
  const u = await getCurrentUser();
  if (!u || !isManager(u.role)) return new NextResponse("Forbidden", { status: 403 });

  const [rows, umap] = await Promise.all([listAllExpenses(), usersMap()]);
  const header = ["Date", "Person", "Department", "Category", "Amount", "Note", "Status", "Decided by", "Submitted"];
  const lines = [header.join(",")];
  for (const e of rows) {
    lines.push(
      [
        e.date,
        umap[e.userId]?.name || e.userId,
        umap[e.userId]?.department || "",
        e.category,
        e.amount,
        e.note,
        e.status,
        e.decidedBy ? umap[e.decidedBy]?.name || e.decidedBy : "",
        (e.createdAt || "").slice(0, 10),
      ]
        .map(cell)
        .join(","),
    );
  }
  const csv = "﻿" + lines.join("\n"); // BOM so Excel reads UTF-8
  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="expenses-${today}.csv"`,
    },
  });
}
