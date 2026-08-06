import { allRows, appendRow, updateWhere, readConfig, setConfig, genId, todayStr } from "./db";

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

export async function recordCheckOut(userId: string, date: string, time: string): Promise<void> {
  await updateWhere("Attendance", (r) => r.userId === userId && r.date === date, { checkOut: time });
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
