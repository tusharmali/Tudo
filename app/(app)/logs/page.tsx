import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { listLogs } from "@/lib/audit";
import LogsClient from "./LogsClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Activity Log" };

export default async function LogsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!isManager(user.role)) redirect("/dashboard");

  const logs = await listLogs(500);
  return (
    <LogsClient
      logs={logs.map((l) => ({
        id: l.id,
        actorName: l.actorName || "System",
        category: l.category || "Other",
        action: l.action,
        detail: l.detail,
        when: (l.createdAt || "").replace("T", " ").slice(0, 16),
      }))}
    />
  );
}
