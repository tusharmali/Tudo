import { allRows, appendRow, updateWhere, deleteWhere, readConfig, setConfig, genId, todayStr } from "./db";
import { getSetting, setSetting } from "./settings";

// ---------- per-person GPS exemption (for fixed PCs that can't move) ----------
const GEO_KEY = (uid: string) => `geoexempt:${uid}`;

/** True if this user may check in WITHOUT a location / geofence check. */
export async function isGeoExempt(userId: string): Promise<boolean> {
  return (await getSetting(GEO_KEY(userId))) === "true";
}
export async function setGeoExempt(userId: string, exempt: boolean): Promise<void> {
  await setSetting(GEO_KEY(userId), exempt ? "true" : "false");
}
/** All user ids currently exempt from the location check. */
export async function listGeoExemptIds(): Promise<string[]> {
  return (await allRows("Settings"))
    .filter((r) => r.key?.startsWith("geoexempt:") && r.value === "true")
    .map((r) => r.key.slice("geoexempt:".length));
}

export interface AttConfig {
  officeLat: number;
  officeLng: number;
  radiusM: number;
  minAccuracyM: number;
  workStart: string;
  graceMin: number;
}

export interface AttRecord {
  id: string;
  userId: string;
  date: string;
  checkIn: string;
  checkOut: string;
  type: string; // office | wfh | leave
  status: string; // present | late | wfh | leave
  lat: string;
  lng: string;
  accuracy: string;
  distanceM: string;
  notes: string;
}

export async function getAttConfig(): Promise<AttConfig> {
  const c = await readConfig("AttendanceConfig");
  return {
    officeLat: Number(c.officeLat ?? "0") || 0,
    officeLng: Number(c.officeLng ?? "0") || 0,
    radiusM: Number(c.radiusM ?? "150") || 150,
    minAccuracyM: Number(c.minAccuracyM ?? "75") || 75,
    workStart: c.workStart || "10:00",
    graceMin: Number(c.graceMin ?? "15") || 15,
  };
}

export function officeIsSet(c: AttConfig): boolean {
  return c.officeLat !== 0 || c.officeLng !== 0;
}

export async function setOffice(lat: number, lng: number, radiusM: number): Promise<void> {
  await setConfig("AttendanceConfig", "officeLat", String(lat));
  await setConfig("AttendanceConfig", "officeLng", String(lng));
  await setConfig("AttendanceConfig", "radiusM", String(Math.max(20, Math.round(radiusM))));
}

export async function getToday(userId: string, date = todayStr()): Promise<AttRecord | null> {
  const rows = await allRows("Attendance");
  const r = rows.find((x) => x.userId === userId && x.date === date);
  return r ? (r as unknown as AttRecord) : null;
}

export async function listByDate(date = todayStr()): Promise<AttRecord[]> {
  const rows = await allRows("Attendance");
  return rows.filter((x) => x.date === date) as unknown as AttRecord[];
}

// ---------- night shifts crossing midnight ----------
// An attendance row is keyed by the day the shift STARTED. A night worker who
// checks in at 22:00 and out at 06:00 has one row dated the first day. After
// midnight `todayStr()` rolls over, so "today's row" lookups would miss the
// open shift — breaking check-out and the current-status view. These helpers
// resolve the shift the user is actually IN, even when it began yesterday.
const MAX_SHIFT_HOURS = 16; // an open shift older than this is a forgotten check-out, not a live overnight shift

/** A calendar date (YYYY-MM-DD, workspace tz) offset from today by whole days. */
export function shiftDate(offsetDays: number, tz = "Asia/Kolkata"): string {
  const at = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** Hours since a record's check-in, correct across midnight. India is a fixed
 *  +05:30 offset (no DST), so the IST wall-clock time anchors directly. */
export function hoursSinceCheckIn(rec: AttRecord): number {
  if (!rec.checkIn) return Infinity;
  const started = new Date(`${rec.date}T${rec.checkIn}:00+05:30`).getTime();
  if (!Number.isFinite(started)) return Infinity;
  return (Date.now() - started) / 3600000;
}

/** The shift the user is currently IN — a check-in with no check-out — even when
 *  it began yesterday and ran past midnight. Bounded to MAX_SHIFT_HOURS so an old
 *  forgotten check-out isn't mistaken for a live shift. */
export async function getOpenShift(userId: string): Promise<AttRecord | null> {
  const today = todayStr();
  const yest = shiftDate(-1);
  const rows = (await allRows("Attendance")) as unknown as AttRecord[];
  const open = rows
    .filter((r) => r.userId === userId && (r.date === today || r.date === yest) && r.checkIn && !r.checkOut)
    .sort((a, b) => (b.date + b.checkIn).localeCompare(a.date + a.checkIn));
  const cand = open[0];
  return cand && hoursSinceCheckIn(cand) <= MAX_SHIFT_HOURS ? cand : null;
}

/** The record representing the user's status right now: today's row if they have
 *  one, otherwise an overnight shift still open from yesterday. Use this (not
 *  getToday) wherever "am I checked in?" is asked, so shifts that cross midnight
 *  keep working. */
export async function getCurrentShift(userId: string): Promise<AttRecord | null> {
  const today = await getToday(userId);
  if (today) return today;
  return getOpenShift(userId);
}

/** Rows that count as "active today" for a roster: every row dated today, plus
 *  still-open overnight shifts carried from yesterday (one per user, today wins). */
export async function listActiveForToday(): Promise<AttRecord[]> {
  const today = todayStr();
  const yest = shiftDate(-1);
  const rows = (await allRows("Attendance")) as unknown as AttRecord[];
  const todays = rows.filter((r) => r.date === today);
  const seen = new Set(todays.map((r) => r.userId));
  const carried = rows.filter(
    (r) => r.date === yest && r.checkIn && !r.checkOut && !seen.has(r.userId) && hoursSinceCheckIn(r) <= MAX_SHIFT_HOURS,
  );
  return [...todays, ...carried];
}

export async function recordCheckIn(input: {
  userId: string;
  date: string;
  time: string;
  type: string;
  status: string;
  lat: number;
  lng: number;
  accuracy: number;
  distanceM: number;
}): Promise<void> {
  const existing = await getToday(input.userId, input.date);
  const patch = {
    type: input.type,
    status: input.status,
    lat: String(input.lat),
    lng: String(input.lng),
    accuracy: String(Math.round(input.accuracy)),
    distanceM: String(Math.round(input.distanceM)),
  };
  if (existing) {
    await updateWhere("Attendance", (r) => r.id === existing.id, {
      ...patch,
      checkIn: existing.checkIn || input.time,
    });
  } else {
    await appendRow("Attendance", {
      id: genId("att"),
      userId: input.userId,
      date: input.date,
      checkIn: input.time,
      checkOut: "",
      notes: "",
      ...patch,
    });
  }
}

/** Close the user's open shift (today's, or an overnight one from yesterday).
 *  Returns false when there's nothing open to check out of. */
export async function recordCheckOut(userId: string, time: string): Promise<boolean> {
  const rec = await getCurrentShift(userId);
  if (!rec || !rec.checkIn || rec.checkOut) return false;
  await updateWhere("Attendance", (r) => r.id === rec.id, { checkOut: time });
  return true;
}

/** Manager fix: clear a mistaken check-out (keeps the check-in). */
export async function clearCheckOut(userId: string, date: string): Promise<number> {
  return updateWhere("Attendance", (r) => r.userId === userId && r.date === date, { checkOut: "" });
}

/** Manager fix: remove a whole day's attendance record (undo a check-in). */
export async function removeAttendance(userId: string, date: string): Promise<number> {
  return deleteWhere("Attendance", (r) => r.userId === userId && r.date === date);
}

/** Distance in metres between two lat/lng points. */
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Current HH:MM in the workspace timezone. */
export function nowHM(tz = "Asia/Kolkata"): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}
