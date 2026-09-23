/** Attendance analytics, aggregated for the Reports page. */
import { allRows, todayStr } from "./db";
import { listByDate as attByDate } from "./attendance";
import { listApprovedForDate } from "./leave";
import { listUsers } from "./users";

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
