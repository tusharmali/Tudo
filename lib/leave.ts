import { allRows, appendRow, updateWhere, genId, todayStr } from "./db";

export type LeaveType = "leave" | "wfh";
export type LeaveStatus = "pending" | "approved" | "rejected";

export interface LeaveReq {
  id: string;
  userId: string;
  type: LeaveType;
  fromDate: string;
  toDate: string;
  reason: string;
  status: LeaveStatus;
  decidedBy: string;
  decidedAt: string;
  createdAt: string;
}

export async function createLeave(
  userId: string,
  type: LeaveType,
  fromDate: string,
  toDate: string,
  reason: string,
): Promise<void> {
  await appendRow("LeaveRequests", {
    id: genId("lv"),
    userId,
    type,
    fromDate,
    toDate: toDate || fromDate,
    reason: reason || "",
    status: "pending",
    decidedBy: "",
    decidedAt: "",
    createdAt: new Date().toISOString(),
  });
}

async function all(): Promise<LeaveReq[]> {
  return (await allRows("LeaveRequests")) as unknown as LeaveReq[];
}

export async function listForUser(userId: string): Promise<LeaveReq[]> {
  return (await all()).filter((r) => r.userId === userId).reverse();
}

export async function listPending(): Promise<LeaveReq[]> {
  return (await all()).filter((r) => r.status === "pending");
}

export async function getLeave(id: string): Promise<LeaveReq | null> {
  return (await all()).find((r) => r.id === id) ?? null;
}

/** Approved requests whose window hasn't ended yet — revocable by a manager. */
export async function listUpcomingApproved(date = todayStr()): Promise<LeaveReq[]> {
  return (await all()).filter((r) => r.status === "approved" && (r.toDate || r.fromDate) >= date);
}

/** Every approved leave / WFH — for the team calendar. */
export async function listAllApproved(): Promise<LeaveReq[]> {
  return (await all()).filter((r) => r.status === "approved");
}

export async function listApprovedForDate(date = todayStr()): Promise<LeaveReq[]> {
  return (await all()).filter(
    (r) => r.status === "approved" && r.fromDate <= date && date <= (r.toDate || r.fromDate),
  );
}

export async function decide(id: string, decision: "approved" | "rejected", adminId: string): Promise<void> {
  await updateWhere("LeaveRequests", (r) => r.id === id, {
    status: decision,
    decidedBy: adminId,
    decidedAt: new Date().toISOString(),
  });
}

/** Is this user on approved leave / approved WFH for the given day? */
export async function statusForToday(
  userId: string,
  date = todayStr(),
): Promise<{ onLeave: boolean; wfhApproved: boolean }> {
  const rows = (await all()).filter(
    (r) =>
      r.userId === userId &&
      r.status === "approved" &&
      r.fromDate <= date &&
      date <= (r.toDate || r.fromDate),
  );
  return {
    onLeave: rows.some((r) => r.type === "leave"),
    wfhApproved: rows.some((r) => r.type === "wfh"),
  };
}
