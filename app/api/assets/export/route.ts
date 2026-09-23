import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { listAssets } from "@/lib/assets";
import { usersMap } from "@/lib/users";

export const dynamic = "force-dynamic";

function cell(v: string): string {
  const s = (v ?? "").toString();
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV export of the asset register — managers/HR only. */
export async function GET() {
  const u = await getCurrentUser();
  if (!u || !isManager(u.role)) return new NextResponse("Forbidden", { status: 403 });

  const [rows, umap] = await Promise.all([listAssets(), usersMap()]);
  const header = ["Name", "Type", "Serial", "Provider", "Assigned to", "Status", "Cost", "Purchase date", "Notes"];
  const lines = [header.join(",")];
  for (const a of rows) {
    lines.push(
      [a.name, a.type, a.serial, a.provider, a.assignedTo ? umap[a.assignedTo]?.name || a.assignedTo : "", a.status, a.cost, a.purchaseDate, a.notes]
        .map(cell)
        .join(","),
    );
  }
  const csv = "﻿" + lines.join("\n");
  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="assets-${today}.csv"`,
    },
  });
}
