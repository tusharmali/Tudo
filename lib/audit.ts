/** Lightweight audit log — records who did what, for the admin Logs page.
 *  Logging never throws into the caller: a failed log must not break an action. */
import { allRows, appendRow, genId } from "./db";

export interface LogEntry {
  id: string;
  actorId: string;
  actorName: string;
  category: string;
  action: string;
  detail: string;
  createdAt: string;
}

export async function logAction(
  actor: { sub?: string; name?: string } | null | undefined,
  category: string,
  action: string,
  detail = "",
): Promise<void> {
  try {
    await appendRow("AuditLog", {
      id: genId("log"),
      actorId: actor?.sub || "",
      actorName: actor?.name || "System",
      category,
      action,
      detail: detail.slice(0, 400),
      createdAt: new Date().toISOString(),
    });
  } catch {
    /* logging must never break the action it records */
  }
}

export async function listLogs(limit = 500): Promise<LogEntry[]> {
  const rows = (await allRows("AuditLog")) as unknown as LogEntry[];
  return rows.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, limit);
}
