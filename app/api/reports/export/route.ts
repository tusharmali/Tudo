import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { attendanceAnalytics, type AnalyticsRow } from "@/lib/reports";
import { todayStr } from "@/lib/db";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const cell = (v: string | number): string => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const row = (cells: (string | number)[]): string => cells.map(cell).join(",");

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!isManager(user?.role)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const today = todayStr();
  const from = DATE.test(sp.get("from") || "") ? (sp.get("from") as string) : today.slice(0, 8) + "01";
  const to = DATE.test(sp.get("to") || "") ? (sp.get("to") as string) : today;
  const dept = sp.get("dept") || "all";
  if (from > to) return NextResponse.json({ error: "Start date is after end date." }, { status: 400 });

  const a = await attendanceAnalytics(from, to, dept);

  const sum = (k: keyof AnalyticsRow) => a.rows.reduce((t, r) => t + (Number(r[k]) || 0), 0);
  const avgRate = a.rows.length ? Math.round(a.rows.reduce((t, r) => t + r.ratePct, 0) / a.rows.length) : 0;

  const lines: string[] = [
    row(["Tudo — Attendance Report"]),
    row(["Period", `${from} to ${to}`]),
    row(["Department", dept === "all" ? "All departments" : dept]),
    row(["Working days (Mon–Fri)", a.workingDays]),
    row(["Members", a.rows.length]),
    row(["Generated", new Date().toISOString()]),
    "",
    row(["Department", "Member", "Role", "Present (office)", "WFH", "Leave", "Logged days", "Absent", "Late arrivals", "Avg check-in", "Attendance %"]),
    ...a.rows.map((r) =>
      row([r.department, r.name, r.role, r.present, r.wfh, r.leave, r.loggedDays, r.absent, r.late, r.avgCheckIn, `${r.ratePct}%`]),
    ),
    "",
    row(["TOTAL", `${a.rows.length} members`, "", sum("present"), sum("wfh"), sum("leave"), sum("loggedDays"), sum("absent"), sum("late"), "", `${avgRate}% avg`]),
  ];

  const csv = "﻿" + lines.join("\r\n"); // BOM so Excel reads UTF-8
  const fname = `tudo-attendance_${dept}_${from}_to_${to}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fname}"`,
      "Cache-Control": "no-store",
    },
  });
}
