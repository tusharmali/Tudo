import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { listAllApproved, listPending, type LeaveReq } from "@/lib/leave";
import { listOverrides } from "@/lib/workcal";
import { usersMap } from "@/lib/users";
import CalendarClient from "./CalendarClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const mgr = isManager(user.role);

  // Working-day overrides are for everyone; leave details (approved + pending
  // requests) only for managers.
  const [leaves, pending, umap, overrides] = await Promise.all([
    mgr ? listAllApproved() : Promise.resolve([]),
    mgr ? listPending() : Promise.resolve([]),
    usersMap(),
    listOverrides(),
  ]);
  const toEntry = (l: LeaveReq, status: "approved" | "pending") => ({
    id: l.id,
    userId: l.userId,
    name: umap[l.userId]?.name || "Someone",
    color: umap[l.userId]?.avatarColor || "#7178DD",
    dept: umap[l.userId]?.department || "",
    type: l.type,
    half: l.half,
    from: l.fromDate,
    to: l.toDate || l.fromDate,
    reason: l.reason,
    status,
  });
  const entries = [...leaves.map((l) => toEntry(l, "approved")), ...pending.map((l) => toEntry(l, "pending"))];

  return <CalendarClient entries={entries} overrides={overrides} isManager={mgr} />;
}
