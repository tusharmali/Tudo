/** Shift breaks — a member marks break start / break end from the dashboard.
 *  An open break (no end) means they're currently on break. Durations are in
 *  minutes. Times are HH:MM in the office timezone. */
import { allRows, appendRow, updateWhere, genId, todayStr } from "./db";

export interface Break {
  id: string;
  userId: string;
  date: string;
  start: string; // HH:MM
  end: string; // HH:MM, "" while on break
  durationMin: string;
  note: string;
  createdAt: string;
}

function nowHM(tz = "Asia/Kolkata"): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}
function toMin(hm: string): number {
  const [h, m] = (hm || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
export function breakDiffMin(start: string, end: string): number {
  let d = toMin(end) - toMin(start);
  if (d < 0) d += 1440; // spanned midnight
  return d;
}

async function all(): Promise<Break[]> {
  return (await allRows("Breaks")) as unknown as Break[];
}

export async function openBreakFor(userId: string, date = todayStr()): Promise<Break | null> {
  return (await all()).find((b) => b.userId === userId && b.date === date && !b.end) ?? null;
}

export async function startBreak(userId: string, note = ""): Promise<{ ok: boolean; error?: string }> {
  const date = todayStr();
  if (await openBreakFor(userId, date)) return { ok: false, error: "You're already on a break." };
  await appendRow("Breaks", {
    id: genId("brk"),
    userId,
    date,
    start: nowHM(),
    end: "",
    durationMin: "",
    note: note.trim().slice(0, 120),
    createdAt: new Date().toISOString(),
  });
  return { ok: true };
}

export async function endBreak(userId: string): Promise<{ ok: boolean; error?: string; min?: number }> {
  const open = await openBreakFor(userId);
  if (!open) return { ok: false, error: "You're not on a break." };
  const end = nowHM();
  const min = breakDiffMin(open.start, end);
  await updateWhere("Breaks", (r) => r.id === open.id, { end, durationMin: String(min) });
  return { ok: true, min };
}

export async function listBreaks(opts?: { date?: string; userIds?: string[]; sinceDate?: string }): Promise<Break[]> {
  let rows = await all();
  if (opts?.date) rows = rows.filter((b) => b.date === opts.date);
  if (opts?.sinceDate) rows = rows.filter((b) => b.date >= opts.sinceDate!);
  if (opts?.userIds) {
    const s = new Set(opts.userIds);
    rows = rows.filter((b) => s.has(b.userId));
  }
  return rows.sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
}

/** Total break minutes today per user (finished + ongoing). */
export async function breakMinutesToday(userIds?: string[]): Promise<Record<string, number>> {
  const rows = await listBreaks({ date: todayStr(), userIds });
  const out: Record<string, number> = {};
  for (const b of rows) {
    const mins = b.end ? Number(b.durationMin || 0) : breakDiffMin(b.start, nowHM());
    out[b.userId] = (out[b.userId] || 0) + mins;
  }
  return out;
}
