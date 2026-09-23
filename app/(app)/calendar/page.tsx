import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { listAllApproved } from "@/lib/leave";
import { usersMap } from "@/lib/users";
import CalendarClient from "./CalendarClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!isManager(user.role)) redirect("/dashboard");

  const [leaves, umap] = await Promise.all([listAllApproved(), usersMap()]);
  const entries = leaves.map((l) => ({
    userId: l.userId,
    name: umap[l.userId]?.name || "Someone",
    color: umap[l.userId]?.avatarColor || "#7178DD",
    dept: umap[l.userId]?.department || "",
    type: l.type,
    from: l.fromDate,
    to: l.toDate || l.fromDate,
    reason: l.reason,
  }));

  return <CalendarClient entries={entries} />;
}
