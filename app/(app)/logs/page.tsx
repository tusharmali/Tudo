import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { listLogs } from "@/lib/audit";
import { NOTIFY_ACTIONS, notifyPrefs } from "@/lib/notify-prefs";
import LogsClient from "./LogsClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Activity & Notifications" };

export default async function LogsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!isManager(user.role)) redirect("/dashboard");

  const [logs, prefs] = await Promise.all([listLogs(500), notifyPrefs()]);
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
      notifyActions={NOTIFY_ACTIONS}
      notifyPrefs={prefs}
    />
  );
}
