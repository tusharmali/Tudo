/**
 * Data layer — Neon Postgres.
 *
 * Migrated off Google Sheets (Sheets couldn't handle many concurrent users:
 * a hard ~60 reads/min quota). Each tab in lib/schema.ts is now a Postgres
 * table whose columns are the tab's headers (all TEXT), plus an internal
 * `__rowid` primary key used to target updates/deletes precisely.
 *
 * The exported API is IDENTICAL to the old Sheet layer — allRows / appendRow /
 * appendRows / updateWhere / deleteWhere / readConfig / setConfig / genId /
 * todayStr — so every caller keeps working unchanged. The original Google
 * Sheet implementation is preserved (commented out) at the bottom of this file.
 * Node runtime only.
 */
import { neon } from "@neondatabase/serverless";
import { SCHEMA } from "./schema";

export type Row = Record<string, string>;

let _sql: ReturnType<typeof neon> | null = null;
function db() {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set — point it at your Neon connection string.");
  _sql = neon(url);
  return _sql;
}

/** Quote an identifier (table / column). Names come from SCHEMA, never user input. */
const qi = (s: string) => `"${s.replace(/"/g, '""')}"`;

function columnsFor(tab: string): string[] {
  const cols = (SCHEMA as Record<string, string[]>)[tab];
  if (!cols) throw new Error(`Unknown table "${tab}".`);
  return cols;
}

function rowFrom(raw: Record<string, unknown>): Row {
  const out: Row = {};
  for (const k of Object.keys(raw)) {
    const v = raw[k];
    out[k] = v == null ? "" : String(v);
  }
  return out;
}

/** Every row, including the internal __rowid (used by update/delete). */
async function selectAll(tab: string): Promise<Row[]> {
  const rows = (await db().query(`select * from ${qi(tab)} order by __rowid`)) as Record<string, unknown>[];
  return rows.map(rowFrom);
}

/** Read every row of a tab. Returns only the schema columns (no __rowid). */
export async function allRows(tab: string, _opts?: { fresh?: boolean }): Promise<Row[]> {
  const rows = await selectAll(tab);
  return rows.map(({ __rowid, ...rest }) => rest as Row);
}

/** Append many rows in one INSERT. */
export async function appendRows(tab: string, rows: Row[]): Promise<void> {
  if (!rows.length) return;
  const cols = columnsFor(tab);
  const colList = cols.map(qi).join(", ");
  const tuples: string[] = [];
  const params: string[] = [];
  let p = 1;
  for (const row of rows) {
    tuples.push(`(${cols.map(() => `$${p++}`).join(", ")})`);
    for (const c of cols) params.push(row[c] ?? "");
  }
  await db().query(`insert into ${qi(tab)} (${colList}) values ${tuples.join(", ")}`, params);
}

export async function appendRow(tab: string, data: Row): Promise<void> {
  await appendRows(tab, [data]);
}

/** Update every row matching `pred`, applying `patch`. Returns rows changed. */
export async function updateWhere(tab: string, pred: (row: Row) => boolean, patch: Row): Promise<number> {
  const matches = (await selectAll(tab)).filter((r) => pred(r));
  if (!matches.length) return 0;
  const cols = columnsFor(tab).filter((c) => Object.prototype.hasOwnProperty.call(patch, c));
  if (!cols.length) return matches.length;
  const params: (string | number)[] = [];
  let p = 1;
  const setClause = cols.map((c) => { params.push(patch[c] ?? ""); return `${qi(c)} = $${p++}`; }).join(", ");
  const inList = matches.map((r) => { params.push(Number(r.__rowid)); return `$${p++}`; }).join(", ");
  await db().query(`update ${qi(tab)} set ${setClause} where __rowid in (${inList})`, params);
  return matches.length;
}

/** Delete every row matching `pred`. Returns rows removed. */
export async function deleteWhere(tab: string, pred: (row: Row) => boolean): Promise<number> {
  const matches = (await selectAll(tab)).filter((r) => pred(r));
  if (!matches.length) return 0;
  const params: number[] = [];
  let p = 1;
  const inList = matches.map((r) => { params.push(Number(r.__rowid)); return `$${p++}`; }).join(", ");
  await db().query(`delete from ${qi(tab)} where __rowid in (${inList})`, params);
  return matches.length;
}

/** key/value config tab -> a plain map. */
export async function readConfig(tab: string): Promise<Row> {
  const rows = await allRows(tab);
  const map: Row = {};
  for (const r of rows) if (r.key) map[r.key] = r.value ?? "";
  return map;
}

export async function setConfig(tab: string, key: string, value: string): Promise<void> {
  const changed = await updateWhere(tab, (r) => r.key === key, { value });
  if (changed === 0) await appendRow(tab, { key, value });
}

export function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function todayStr(tz = "Asia/Kolkata"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/* ============================================================================
 * LEGACY — Google Sheets data layer (kept for reference; no longer used).
 * Superseded by the Neon Postgres implementation above. To fall back to
 * Sheets, restore GOOGLE_SHEET_ID / GOOGLE_SERVICE_ACCOUNT_B64 and re-enable.
 * ----------------------------------------------------------------------------
 * import type { GoogleSpreadsheetRow } from "google-spreadsheet";
 * import { JWT } from "google-auth-library";
 * import { getSheet } from "./sheets";
 * import { getServiceAccount, getSheetId } from "./env";
 *
 * const SNAPSHOT_TTL_MS = 12000;
 * let snapshot: { at: number; tabs: Record<string, Row[]> } | null = null;
 * let inflight: Promise<Record<string, Row[]>> | null = null;
 *
 * let authClient: JWT | null = null;
 * function getAuth(): JWT {
 *   if (authClient) return authClient;
 *   const { clientEmail, privateKey } = getServiceAccount();
 *   authClient = new JWT({ email: clientEmail, key: privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
 *   return authClient;
 * }
 *
 * function parseRange(values: string[][] | undefined): Row[] {
 *   const vals = values || [];
 *   const headers = vals[0] || [];
 *   const rows: Row[] = [];
 *   for (let r = 1; r < vals.length; r++) {
 *     const row: Row = {};
 *     for (let c = 0; c < headers.length; c++) { const v = vals[r][c]; row[headers[c]] = v == null ? "" : String(v); }
 *     rows.push(row);
 *   }
 *   return rows;
 * }
 *
 * async function batchGetAll(): Promise<Record<string, Row[]>> {
 *   const auth = getAuth();
 *   const { token } = await auth.getAccessToken();
 *   if (!token) throw new Error("Could not obtain a Google access token.");
 *   const id = getSheetId();
 *   const tabNames = Object.keys(SCHEMA);
 *   const rangesQS = tabNames.map((t) => `ranges=${encodeURIComponent(t)}`).join("&");
 *   const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchGet?${rangesQS}&majorDimension=ROWS`;
 *   let res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
 *   if (res.status === 429) { await new Promise((r) => setTimeout(r, 1500)); res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } }); }
 *   if (!res.ok) { const body = await res.text().catch(() => ""); throw new Error(`Sheets read failed (${res.status}). ${body.slice(0, 160)}`); }
 *   const data = (await res.json()) as { valueRanges?: { values?: string[][] }[] };
 *   const vr = data.valueRanges || [];
 *   const out: Record<string, Row[]> = {};
 *   tabNames.forEach((tab, i) => { out[tab] = parseRange(vr[i]?.values); });
 *   return out;
 * }
 *
 * async function loadSnapshot(fresh = false): Promise<Record<string, Row[]>> {
 *   if (!fresh && snapshot && Date.now() - snapshot.at < SNAPSHOT_TTL_MS) return snapshot.tabs;
 *   if (inflight) return inflight;
 *   inflight = batchGetAll().then((tabs) => { snapshot = { at: Date.now(), tabs }; return tabs; }).finally(() => { inflight = null; });
 *   return inflight;
 * }
 * function invalidate() { snapshot = null; }
 *
 * export async function allRows(tab: string, opts?: { fresh?: boolean }): Promise<Row[]> {
 *   const tabs = await loadSnapshot(opts?.fresh);
 *   return tabs[tab] ? [...tabs[tab]] : [];
 * }
 * export async function appendRows(tab: string, rows: Row[]): Promise<void> {
 *   if (!rows.length) return;
 *   const sheet = await getSheet(tab); await sheet.addRows(rows); invalidate();
 * }
 * function toObj(r: GoogleSpreadsheetRow): Row {
 *   const raw = r.toObject(); const out: Row = {};
 *   for (const k of Object.keys(raw)) { const v = raw[k]; out[k] = v == null ? "" : String(v); }
 *   return out;
 * }
 * export async function appendRow(tab: string, data: Row): Promise<void> {
 *   const sheet = await getSheet(tab); await sheet.addRow(data); invalidate();
 * }
 * export async function updateWhere(tab: string, pred: (row: Row) => boolean, patch: Row): Promise<number> {
 *   const sheet = await getSheet(tab); const rows = await sheet.getRows(); let changed = 0;
 *   for (const r of rows) { if (pred(toObj(r))) { for (const [k, v] of Object.entries(patch)) r.set(k, v); await r.save(); changed++; } }
 *   if (changed) invalidate(); return changed;
 * }
 * export async function deleteWhere(tab: string, pred: (row: Row) => boolean): Promise<number> {
 *   const sheet = await getSheet(tab); const rows = await sheet.getRows(); let removed = 0;
 *   for (let i = rows.length - 1; i >= 0; i--) { if (pred(toObj(rows[i]))) { await rows[i].delete(); removed++; } }
 *   if (removed) invalidate(); return removed;
 * }
 * ========================================================================== */
