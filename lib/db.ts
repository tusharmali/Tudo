/**
 * Google-Sheet data layer, quota-optimized.
 *
 * Google caps reads at ~60/min per service account, shared by ALL app traffic.
 * Reading one tab at a time meant a single dashboard load could fire ~10 reads
 * at once and blow the quota. Instead we read the ENTIRE spreadsheet in ONE
 * `values:batchGet` call (1 quota unit for all tabs), cache that snapshot for a
 * few seconds, and de-duplicate concurrent loads so a burst of reads shares a
 * single request. Writes invalidate the snapshot so you always see your change.
 * Node runtime only.
 */
import type { GoogleSpreadsheetRow } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { getSheet } from "./sheets";
import { getServiceAccount, getSheetId } from "./env";
import { SCHEMA } from "./schema";

export type Row = Record<string, string>;

const SNAPSHOT_TTL_MS = 12000;
let snapshot: { at: number; tabs: Record<string, Row[]> } | null = null;
let inflight: Promise<Record<string, Row[]>> | null = null;

let authClient: JWT | null = null;
function getAuth(): JWT {
  if (authClient) return authClient;
  const { clientEmail, privateKey } = getServiceAccount();
  authClient = new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return authClient;
}

function parseRange(values: string[][] | undefined): Row[] {
  const vals = values || [];
  const headers = vals[0] || [];
  const rows: Row[] = [];
  for (let r = 1; r < vals.length; r++) {
    const row: Row = {};
    for (let c = 0; c < headers.length; c++) {
      const v = vals[r][c];
      row[headers[c]] = v == null ? "" : String(v);
    }
    rows.push(row);
  }
  return rows;
}

/** Read every tab in a single batchGet request (1 quota unit). */
async function batchGetAll(): Promise<Record<string, Row[]>> {
  const auth = getAuth();
  const { token } = await auth.getAccessToken();
  if (!token) throw new Error("Could not obtain a Google access token.");
  const id = getSheetId();
  const tabNames = Object.keys(SCHEMA);
  const rangesQS = tabNames.map((t) => `ranges=${encodeURIComponent(t)}`).join("&");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchGet?${rangesQS}&majorDimension=ROWS`;

  let res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 1500));
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Sheets read failed (${res.status}). ${body.slice(0, 160)}`);
  }
  const data = (await res.json()) as { valueRanges?: { values?: string[][] }[] };
  const vr = data.valueRanges || [];
  const out: Record<string, Row[]> = {};
  tabNames.forEach((tab, i) => {
    out[tab] = parseRange(vr[i]?.values);
  });
  return out;
}

async function loadSnapshot(fresh = false): Promise<Record<string, Row[]>> {
  if (!fresh && snapshot && Date.now() - snapshot.at < SNAPSHOT_TTL_MS) return snapshot.tabs;
  if (inflight) return inflight;
  inflight = batchGetAll()
    .then((tabs) => {
      snapshot = { at: Date.now(), tabs };
      return tabs;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

function invalidate() {
  snapshot = null;
}

/** Read every row of a tab (served from the cached whole-sheet snapshot). */
export async function allRows(tab: string, opts?: { fresh?: boolean }): Promise<Row[]> {
  const tabs = await loadSnapshot(opts?.fresh);
  return tabs[tab] ? [...tabs[tab]] : [];
}

/** Append many rows in ONE API call (batch). */
export async function appendRows(tab: string, rows: Row[]): Promise<void> {
  if (!rows.length) return;
  const sheet = await getSheet(tab);
  await sheet.addRows(rows);
  invalidate();
}

function toObj(r: GoogleSpreadsheetRow): Row {
  const raw = r.toObject();
  const out: Row = {};
  for (const k of Object.keys(raw)) {
    const v = raw[k];
    out[k] = v == null ? "" : String(v);
  }
  return out;
}

export async function appendRow(tab: string, data: Row): Promise<void> {
  const sheet = await getSheet(tab);
  await sheet.addRow(data);
  invalidate();
}

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
  if (changed) invalidate();
  return changed;
}

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
  if (removed) invalidate();
  return removed;
}

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
