import { allRows, appendRow, genId } from "./db";
import { getSetting, setSetting } from "./settings";

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
