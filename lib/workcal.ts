/** Working-day overrides — weekends default to OFF; a manager can flip a
 *  specific weekend to "working", or mark a weekday as a "holiday". Visible to
 *  everyone so the team knows which days are on/off. */
import { allRows, appendRow, updateWhere, deleteWhere } from "./db";

export type DayType = "working" | "holiday";
export interface DayOverride { type: string; note: string }

export async function listOverrides(): Promise<Record<string, DayOverride>> {
  const rows = await allRows("WorkCalendar");
  const map: Record<string, DayOverride> = {};
  for (const r of rows) if (r.date) map[r.date] = { type: r.type || "", note: r.note || "" };
  return map;
}

export async function setOverride(date: string, type: "" | DayType, note: string, setBy: string): Promise<void> {
  if (!type) {
    await deleteWhere("WorkCalendar", (r) => r.date === date);
    return;
  }
  const changed = await updateWhere("WorkCalendar", (r) => r.date === date, { type, note: note.slice(0, 120), setBy });
  if (!changed) {
    await appendRow("WorkCalendar", { date, type, note: note.slice(0, 120), setBy, createdAt: new Date().toISOString() });
  }
}
