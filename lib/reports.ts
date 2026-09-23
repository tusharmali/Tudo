/** Attendance analytics, aggregated for the Reports page. */
import { allRows, todayStr } from "./db";
import { listByDate as attByDate, getAttConfig } from "./attendance";
import { listApprovedForDate } from "./leave";
import { listUsers } from "./users";

// ---------- date/time helpers ----------
const toMin = (hhmm: string): number => {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : -1;
};
const fromMin = (mins: number): string => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
const shiftDate = (iso: string, delta: number): string => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
};
function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = shiftDate(d, 1)) { out.push(d); if (out.length > 3660) break; }
  return out;
}
function countWeekdays(from: string, to: string): number {
  let n = 0;
  for (const d of datesBetween(from, to)) { const wd = new Date(d + "T00:00:00Z").getUTCDay(); if (wd !== 0 && wd !== 6) n++; }
  return n;
}

// ---------- period analytics (for CSV export) ----------
export interface AnalyticsRow {
  name: string;
  department: string;
  role: string;
  present: number;
  wfh: number;
  leave: number;
  absent: number;
  loggedDays: number;
  late: number;
  avgCheckIn: string;
  ratePct: number;
}
export interface Analytics {
  from: string;
  to: string;
  dept: string;
  workingDays: number;
  rows: AnalyticsRow[];
}

/** Per-member attendance analytics over [from, to], optionally one department. */
export async function attendanceAnalytics(from: string, to: string, dept = "all"): Promise<Analytics> {
  const [users, att, leaves, cfg] = await Promise.all([listUsers(), allRows("Attendance"), allRows("LeaveRequests"), getAttConfig()]);
  const inRange = (d: string) => d >= from && d <= to;
  const attInRange = att.filter((a) => inRange(a.date) && a.checkIn);
  const approvedLeaves = leaves.filter((l) => l.status === "approved");
  const workingDays = countWeekdays(from, to);
  const lateAfter = toMin(cfg.workStart) + (cfg.graceMin || 0);

  const targetUsers = users
    .filter((u) => (u.status || "active") !== "suspended" && (dept === "all" || u.department === dept))
    .sort((a, b) => (a.department || "").localeCompare(b.department || "") || a.name.localeCompare(b.name));

  const rows = targetUsers.map((u) => {
    const recs = attInRange.filter((a) => a.userId === u.id);
    const presentDates = new Set(recs.filter((r) => r.type !== "wfh").map((r) => r.date));
    const wfhDates = new Set(recs.filter((r) => r.type === "wfh").map((r) => r.date));
    const leaveDates = new Set<string>();
    for (const l of approvedLeaves.filter((l) => l.userId === u.id && l.type === "leave")) {
      const s = l.fromDate > from ? l.fromDate : from;
      const e = (l.toDate || l.fromDate) < to ? l.toDate || l.fromDate : to;
      if (s <= e) for (const d of datesBetween(s, e)) leaveDates.add(d);
    }
    const late = lateAfter > 0 ? recs.filter((r) => toMin(r.checkIn) > lateAfter).length : 0;
    const mins = recs.map((r) => toMin(r.checkIn)).filter((m) => m >= 0);
    const avgCheckIn = mins.length ? fromMin(Math.round(mins.reduce((a, b) => a + b, 0) / mins.length)) : "";
    const loggedDays = presentDates.size + wfhDates.size;
    const ratePct = workingDays ? Math.round((loggedDays / workingDays) * 100) : 0;
    return {
      name: u.name,
      department: u.department || "-",
      role: u.role,
      present: presentDates.size,
      wfh: wfhDates.size,
      leave: leaveDates.size,
      absent: Math.max(0, workingDays - loggedDays - leaveDates.size),
      loggedDays,
      late,
      avgCheckIn,
      ratePct,
    };
  });

  return { from, to, dept, workingDays, rows };
}

export type MemberState = "in" | "wfh" | "leave" | "absent";

export interface MemberRow {
  id: string;
  name: string;
  department: string;
  state: MemberState;
  checkIn: string;
  checkOut: string;
}

/** One row per active user with their attendance state for `date`. */
export async function attendanceForDate(date: string): Promise<MemberRow[]> {
  const [users, recs, approved] = await Promise.all([listUsers(), attByDate(date), listApprovedForDate(date)]);
  return users
    .filter((u) => (u.status || "active") !== "suspended")
    .map((u) => {
      const rec = recs.find((r) => r.userId === u.id);
      const onLeave = approved.some((a) => a.userId === u.id && a.type === "leave");
      const wfhAppr = approved.some((a) => a.userId === u.id && a.type === "wfh");
      let state: MemberState = "absent";
      if (rec?.checkIn) state = rec.type === "wfh" ? "wfh" : "in";
      else if (onLeave) state = "leave";
      else if (wfhAppr) state = "wfh";
      return {
        id: u.id,
        name: u.name,
        department: u.department || "—",
        state,
        checkIn: rec?.checkIn || "",
        checkOut: rec?.checkOut || "",
      };
    });
}

function addDays(iso: string, delta: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Present (checked-in, incl. WFH check-ins) count per day for the 7 days ending `endDate`. */
export async function last7DaysPresence(endDate = todayStr()): Promise<{ date: string; present: number }[]> {
  const recs = await allRows("Attendance");
  const days: { date: string; present: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = addDays(endDate, -i);
    days.push({ date, present: recs.filter((r) => r.date === date && r.checkIn).length });
  }
  return days;
}
