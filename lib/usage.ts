/**
 * Per-user data footprint — for the owner-only storage page. Attributes each
 * table's rows to a user column and sums their byte sizes, plus each user's
 * display-picture object in the bucket. Both are Neon costs. Node runtime only.
 */
import { allRows } from "./db";
import { listUsers } from "./users";
import { objectSize } from "./storage";
import type { SheetName } from "./schema";

/** Tables that carry a per-user row, and which column attributes it. */
const USER_TABLES: { tab: SheetName; col: string }[] = [
  { tab: "Messages", col: "fromUserId" },
  { tab: "Reactions", col: "userId" },
  { tab: "Tasks", col: "userId" },
  { tab: "WIP", col: "userId" },
  { tab: "Kudos", col: "fromUserId" },
  { tab: "Concerns", col: "fromUserId" },
  { tab: "ConcernReplies", col: "userId" },
  { tab: "Attendance", col: "userId" },
  { tab: "LeaveRequests", col: "userId" },
  { tab: "FunContributions", col: "userId" },
  { tab: "Notifications", col: "createdBy" },
];

function rowBytes(row: Record<string, string>): number {
  let n = 0;
  for (const k in row) n += Buffer.byteLength(row[k] || "", "utf8") + k.length;
  return n;
}

export interface UserUsage {
  userId: string;
  name: string;
  email: string;
  dbBytes: number;
  rows: number;
  fileBytes: number;
  totalBytes: number;
  byTable: Record<string, number>;
}

export interface UsageReport {
  users: UserUsage[];
  totals: { dbBytes: number; fileBytes: number; rows: number; totalBytes: number };
}

export async function usageByUser(): Promise<UsageReport> {
  const users = await listUsers();
  const acc: Record<string, UserUsage> = {};
  for (const u of users) {
    acc[u.id] = { userId: u.id, name: u.name, email: u.email, dbBytes: 0, rows: 0, fileBytes: 0, totalBytes: 0, byTable: {} };
  }
  const unknown: UserUsage = { userId: "", name: "Unattributed / system", email: "", dbBytes: 0, rows: 0, fileBytes: 0, totalBytes: 0, byTable: {} };

  for (const { tab, col } of USER_TABLES) {
    const rows = await allRows(tab);
    for (const r of rows) {
      const uid = (r[col] || "").trim();
      const bucket = acc[uid] || unknown;
      const b = rowBytes(r);
      bucket.dbBytes += b;
      bucket.rows += 1;
      bucket.byTable[tab] = (bucket.byTable[tab] || 0) + b;
    }
  }

  // Display-picture objects in the bucket.
  await Promise.all(
    users.map(async (u) => {
      if (u.avatar) acc[u.id].fileBytes += await objectSize(u.avatar);
    }),
  );

  const list = Object.values(acc).filter((u) => u.rows > 0 || u.fileBytes > 0);
  if (unknown.rows > 0) list.push(unknown);
  for (const u of list) u.totalBytes = u.dbBytes + u.fileBytes;
  list.sort((a, b) => b.totalBytes - a.totalBytes);

  const totals = list.reduce(
    (t, u) => ({ dbBytes: t.dbBytes + u.dbBytes, fileBytes: t.fileBytes + u.fileBytes, rows: t.rows + u.rows, totalBytes: t.totalBytes + u.totalBytes }),
    { dbBytes: 0, fileBytes: 0, rows: 0, totalBytes: 0 },
  );
  return { users: list, totals };
}
