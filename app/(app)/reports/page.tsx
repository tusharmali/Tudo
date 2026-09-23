import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { todayStr } from "@/lib/db";
import { attendanceForDate, last7DaysPresence } from "@/lib/reports";
import ReportsClient from "./ReportsClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!isManager(user.role)) redirect("/dashboard");

  const today = todayStr();
  const sp = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date || "") ? (sp.date as string) : today;

  const [rows, trend] = await Promise.all([attendanceForDate(date), last7DaysPresence(date)]);

  return <ReportsClient date={date} today={today} rows={rows} trend={trend} />;
}
