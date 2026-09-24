import { allRows, appendRow, updateWhere, genId, todayStr } from "./db";

export type LeaveType = "leave" | "wfh" | "half" | "short";
export type LeaveStatus = "pending" | "approved" | "rejected";

/** leave = full day off · wfh = work from home · half = half-day leave
 *  (portion in `half`) · short = leaving early / urgency. half & short are
 *  partial-day, so they don't lock attendance. */
export function leaveLabel(type: string, half = ""): string {
  if (type === "wfh") return "WFH";
  if (type === "half") return half === "first" ? "Half day (1st)" : half === "second" ? "Half day (2nd)" : "Half day";
  if (type === "short") return "Early out";
  return "Leave";
}

export interface LeaveReq {
  id: string;
  userId: string;
  type: LeaveType;
  fromDate: string;
  toDate: string;
  reason: string;
  half: string; // "first" | "second" | "" — the portion, for half-day
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
  half = "",
): Promise<void> {
  // Half-day and early-out are single-day by nature.
  const to = type === "half" || type === "short" ? fromDate : toDate || fromDate;
  await appendRow("LeaveRequests", {
    id: genId("lv"),
    userId,
    type,
    fromDate,
    toDate: to,
    reason: reason || "",
    half: type === "half" && (half === "first" || half === "second") ? half : "",
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
