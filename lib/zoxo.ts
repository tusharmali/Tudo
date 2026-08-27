/**
 * Zoxo backend — data layer for the separate "Zoxo Backend" spreadsheet.
 *
 * Uses the same Tudo service account (tudo-bot@…) but a different sheet id, so
 * tester activity never mixes with the team's Tudo data. Node runtime only.
 */
import { JWT } from "google-auth-library";
import { getServiceAccount } from "./env";
import { ZOXO_SCHEMA, type ZoxoSheetName } from "./zoxo-schema";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const API = "https://sheets.googleapis.com/v4/spreadsheets";

export type Row = Record<string, string>;

let authClient: JWT | null = null;

function auth(): JWT {
  if (authClient) return authClient;
  const { clientEmail, privateKey } = getServiceAccount();
  authClient = new JWT({ email: clientEmail, key: privateKey, scopes: SCOPES });
  return authClient;
}

export function getZoxoSheetId(): string {
  const id = process.env.ZOXO_SHEET_ID;
  if (!id) throw new Error("ZOXO_SHEET_ID is not set. See .env.local.example.");
  return id.trim();
}

/** The shared key testers paste into the extension. Empty = open (dev only). */
export function getIngestKey(): string {
  return (process.env.ZOXO_INGEST_KEY || "").trim();
}

export function checkIngestKey(header: string | null): boolean {
  const expected = getIngestKey();
  if (!expected) {
    // An unset key means "open" only while developing. On a deployed site that
    // would let anyone write rows into the team's sheet, so refuse instead.
    return process.env.NODE_ENV !== "production";
  }
  return (header || "").trim() === expected;
}

async function token(): Promise<string> {
  const { token: t } = await auth().getAccessToken();
  if (!t) throw new Error("Could not obtain a Google access token.");
  return t;
}

async function api(path: string, init?: RequestInit): Promise<Response> {
  const t = await token();
  const res = await fetch(`${API}/${getZoxoSheetId()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${t}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 1200));
    return api(path, init);
  }
  return res;
}

function toRows(values: string[][] | undefined): Row[] {
  const vals = values || [];
  const headers = vals[0] || [];
  const out: Row[] = [];
  for (let r = 1; r < vals.length; r++) {
    const row: Row = { __row: String(r + 1) };
    headers.forEach((h, c) => {
      row[h] = vals[r][c] == null ? "" : String(vals[r][c]);
    });
    out.push(row);
  }
  return out;
}

/** Read one tab. Cached briefly so a burst of events does not blow the quota. */
const cache = new Map<string, { at: number; rows: Row[] }>();
const TTL_MS = 15000;

export async function readTab(tab: ZoxoSheetName, fresh = false): Promise<Row[]> {
  const hit = cache.get(tab);
  if (!fresh && hit && Date.now() - hit.at < TTL_MS) return hit.rows;
  const res = await api(`/values/${encodeURIComponent(tab)}?majorDimension=ROWS`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Zoxo sheet read failed (${res.status}). ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { values?: string[][] };
  const rows = toRows(data.values);
  cache.set(tab, { at: Date.now(), rows });
  return rows;
}

export function invalidate(tab?: ZoxoSheetName) {
  if (tab) cache.delete(tab);
  else cache.clear();
}

/** Append records (objects keyed by header name) to a tab in one call. */
export async function appendRows(tab: ZoxoSheetName, records: Row[]): Promise<number> {
  if (!records.length) return 0;
  const headers = ZOXO_SCHEMA[tab];
  const values = records.map((rec) => headers.map((h) => (rec[h] == null ? "" : String(rec[h]))));
  const res = await api(
    `/values/${encodeURIComponent(tab)}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values }) },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Zoxo sheet append failed (${res.status}). ${body.slice(0, 200)}`);
  }
  invalidate(tab);
  return records.length;
}

/** Overwrite one existing row (1-based sheet row number). */
export async function updateRow(tab: ZoxoSheetName, rowNumber: number, rec: Row): Promise<void> {
  const headers = ZOXO_SCHEMA[tab];
  const values = [headers.map((h) => (rec[h] == null ? "" : String(rec[h])))];
  const range = `${tab}!A${rowNumber}`;
  const res = await api(`/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
    method: "PUT",
    body: JSON.stringify({ values }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Zoxo sheet update failed (${res.status}). ${body.slice(0, 200)}`);
  }
  invalidate(tab);
}

/* ------------------------------------------------------------- domain */

export type Envelope = {
  deviceId?: string;
  email?: string;
  name?: string;
  os?: string;
  browser?: string;
  screen?: string;
  tz?: string;
  locale?: string;
  extVersion?: string;
};

function testerKey(email: string, deviceId: string) {
  return `${(email || "anon").toLowerCase()}|${deviceId || "-"}`;
}

export function makeTesterId(email: string, deviceId: string): string {
  const base = testerKey(email, deviceId);
  let hash = 0;
  for (let i = 0; i < base.length; i++) hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
  const local = (email || "tester").split("@")[0].replace(/[^a-z0-9]/gi, "").slice(0, 12) || "tester";
  return `${local}-${hash.toString(36)}`;
}

/**
 * Find or create the Testers row for this install and refresh lastSeenAt.
 * @returns the tester id
 */
export async function upsertTester(
  env: Envelope,
  opts: { countSession?: boolean; addEvents?: number } = {},
): Promise<{ testerId: string; created: boolean }> {
  const email = (env.email || "").toLowerCase();
  const deviceId = env.deviceId || "";
  const id = makeTesterId(email, deviceId);
  const now = new Date().toISOString();
  const rows = await readTab("Testers");
  const existing = rows.find((r) => r.id === id);

  if (!existing) {
    await appendRows("Testers", [
      {
        id,
        email,
        name: env.name || "",
        deviceId,
        os: env.os || "",
        browser: env.browser || "",
        screen: env.screen || "",
        timezone: env.tz || "",
        locale: env.locale || "",
        extVersion: env.extVersion || "",
        firstSeenAt: now,
        lastSeenAt: now,
        sessions: opts.countSession ? "1" : "0",
        events: String(opts.addEvents || 0),
        status: "active",
      },
    ]);
    return { testerId: id, created: true };
  }

  const rowNumber = Number(existing.__row);
  await updateRow("Testers", rowNumber, {
    ...existing,
    email: email || existing.email,
    name: env.name || existing.name,
    os: env.os || existing.os,
    browser: env.browser || existing.browser,
    screen: env.screen || existing.screen,
    timezone: env.tz || existing.timezone,
    locale: env.locale || existing.locale,
    extVersion: env.extVersion || existing.extVersion,
    lastSeenAt: now,
    sessions: String(Number(existing.sessions || 0) + (opts.countSession ? 1 : 0)),
    events: String(Number(existing.events || 0) + (opts.addEvents || 0)),
    status: existing.status || "active",
  });
  return { testerId: id, created: false };
}

/**
 * Config as a plain map. Sheets silently turns "true"/"false" typed into a
 * cell into a boolean and hands it back as "TRUE"/"FALSE", so booleans are
 * normalised here and clients never have to care how a value was entered.
 */
export async function getConfig(): Promise<Record<string, string>> {
  const rows = await readTab("Config");
  const out: Record<string, string> = {};
  rows.forEach((r) => {
    if (!r.key) return;
    const value = String(r.value ?? "").trim();
    out[r.key] = /^(true|false)$/i.test(value) ? value.toLowerCase() : value;
  });
  return out;
}

/** Trim overly long free-text so one bad client cannot bloat the sheet. */
export function clip(value: unknown, max = 300): string {
  return String(value ?? "").slice(0, max);
}

export function toNumberString(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) && n !== 0 ? String(Math.round(n)) : n === 0 ? "0" : "";
}
