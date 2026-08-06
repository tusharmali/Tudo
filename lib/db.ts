/**
 * Generic Google-Sheet data helpers with a short-TTL in-memory cache.
 *
 * The Google Sheets API caps reads at ~60/min per service account, shared by
 * ALL app traffic. Without caching, one dashboard load (many tabs, some read
 * repeatedly) plus polling blows the quota. The cache collapses repeated reads
 * of the same tab into one API call per TTL window, and writes invalidate it.
 * Node runtime only.
 */
import type { GoogleSpreadsheetRow } from "google-spreadsheet";
import { getSheet } from "./sheets";

export type Row = Record<string, string>;

const CACHE_TTL_MS = 8000;
const cache = new Map<string, { at: number; rows: Row[] }>();

function invalidate(tab: string) {
  cache.delete(tab);
}

function toObj(r: GoogleSpreadsheetRow): Row {
  const raw = r.toObject();
  const out: Row = {};
  for (const k of Object.keys(raw)) {
    const v = raw[k];
    out[k] = v === undefined || v === null ? "" : String(v);
  }
  return out;
}

function is429(e: unknown): boolean {
  const err = e as { code?: number; status?: number; response?: { status?: number }; message?: string };
  return err?.code === 429 || err?.status === 429 || err?.response?.status === 429 || (err?.message || "").includes("Quota exceeded");
}

async function fetchRows(tab: string): Promise<Row[]> {
  try {
    const sheet = await getSheet(tab);
    return (await sheet.getRows()).map(toObj);
  } catch (e) {
    if (!is429(e)) throw e;
    // Ride out a brief quota spike, then retry once.
    await new Promise((r) => setTimeout(r, 1500));
    const sheet = await getSheet(tab);
    return (await sheet.getRows()).map(toObj);
  }
}

/** Read every row of a tab as plain objects (cached ~8s unless `fresh`). */
export async function allRows(tab: string, opts?: { fresh?: boolean }): Promise<Row[]> {
  const now = Date.now();
  if (!opts?.fresh) {
    const hit = cache.get(tab);
    if (hit && now - hit.at < CACHE_TTL_MS) return hit.rows;
  }
  const rows = await fetchRows(tab);
  cache.set(tab, { at: now, rows });
  return rows;
}

/** Append one row. */
export async function appendRow(tab: string, data: Row): Promise<void> {
  const sheet = await getSheet(tab);
  await sheet.addRow(data);
  invalidate(tab);
}

/** Update every row matching `pred`; returns the number changed. */
export async function updateWhere(tab: string, pred: (row: Row) => boolean, patch: Row): Promise<number> {
  const sheet = await getSheet(tab);
  const rows = await sheet.getRows();
  let changed = 0;
  for (const r of rows) {
    if (pred(toObj(r))) {
      for (const [k, v] of Object.entries(patch)) r.set(k, v);
      await r.save();
      changed++;
    }
  }
  if (changed) invalidate(tab);
  return changed;
}

/** Delete every row matching `pred`; returns the number removed. */
export async function deleteWhere(tab: string, pred: (row: Row) => boolean): Promise<number> {
  const sheet = await getSheet(tab);
  const rows = await sheet.getRows();
  let removed = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (pred(toObj(rows[i]))) {
      await rows[i].delete();
      removed++;
    }
  }
  if (removed) invalidate(tab);
  return removed;
}

/** Read a key/value tab (Settings, AttendanceConfig) into a map. */
export async function readConfig(tab: string): Promise<Row> {
  const rows = await allRows(tab);
  const map: Row = {};
  for (const r of rows) if (r.key) map[r.key] = r.value ?? "";
  return map;
}

/** Set a key in a key/value tab (insert or update). */
export async function setConfig(tab: string, key: string, value: string): Promise<void> {
  const changed = await updateWhere(tab, (r) => r.key === key, { value });
  if (changed === 0) await appendRow(tab, { key, value });
}

/** Short unique id like "tk_lp3f9a2b". */
export function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Today's date as YYYY-MM-DD in the given IANA tz (default Asia/Kolkata). */
export function todayStr(tz = "Asia/Kolkata"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
