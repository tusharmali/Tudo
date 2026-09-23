import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { listAllApproved } from "@/lib/leave";
import { listOverrides } from "@/lib/workcal";
import { usersMap } from "@/lib/users";
import CalendarClient from "./CalendarClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const mgr = isManager(user.role);

  // Working-day overrides are for everyone; leave details only for managers.
  const [leaves, umap, overrides] = await Promise.all([
    mgr ? listAllApproved() : Promise.resolve([]),
    usersMap(),
    listOverrides(),
  ]);
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

  return <CalendarClient entries={entries} overrides={overrides} isManager={mgr} />;
}
