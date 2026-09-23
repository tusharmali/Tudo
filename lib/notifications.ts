import { allRows, appendRow, deleteWhere, genId } from "./db";
import { getSetting, setSetting } from "./settings";
import { sendToUsers } from "./push";

export interface Notification {
  id: string;
  title: string;
  body: string;
  target: string; // "all" or comma-separated userIds
  createdBy: string;
  createdAt: string;
}

export async function create(title: string, body: string, target: string, createdBy: string): Promise<void> {
  await appendRow("Notifications", {
    id: genId("nt"),
    title,
    body,
    target,
    createdBy,
    createdAt: new Date().toISOString(),
  });
}

/** Notify one member — bell entry + push. Never throws into the caller. */
export async function notifyUser(userId: string, title: string, body: string, createdBy = "system", url = "/dashboard"): Promise<void> {
  try {
    await create(title, body, userId, createdBy);
    await sendToUsers([userId], { title, body, url }).catch(() => {});
  } catch {
    /* a failed notification must not break the action */
  }
}

export async function listAll(): Promise<Notification[]> {
  const rows = (await allRows("Notifications")) as unknown as Notification[];
  return rows.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export async function listForUser(userId: string): Promise<Notification[]> {
  return (await listAll()).filter((n) => n.target === "all" || n.target.split(",").includes(userId));
}

export async function getLastRead(userId: string): Promise<string> {
  return getSetting(`notifread:${userId}`);
}

export async function markRead(userId: string): Promise<void> {
  await setSetting(`notifread:${userId}`, new Date().toISOString());
}

/** Admin: remove a single notification. Returns rows removed. */
export async function remove(id: string): Promise<number> {
  return deleteWhere("Notifications", (r) => r.id === id);
}

/** Admin: clear every notification. Returns rows removed. */
export async function clearAll(): Promise<number> {
  return deleteWhere("Notifications", () => true);
}
