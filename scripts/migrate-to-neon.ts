/**
 * One-time migration: Google Sheet  ->  Neon Postgres.
 *   npx tsx scripts/migrate-to-neon.ts
 *
 * Creates a Postgres table for every tab in lib/schema.ts (columns = the tab's
 * headers, all TEXT, plus an internal __rowid), then copies the current Sheet
 * contents in. Idempotent: a table that already has rows is left untouched, so
 * re-running never duplicates data or clobbers users added after migration.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { neon } from "@neondatabase/serverless";
import { JWT } from "google-auth-library";
import { SCHEMA } from "../lib/schema";
import { getServiceAccount, getSheetId } from "../lib/env";

const sql = neon(process.env.DATABASE_URL!);
const qi = (s: string) => `"${s.replace(/"/g, '""')}"`;

type Rows = Record<string, string>[];

async function readSheet(): Promise<Record<string, Rows>> {
  const { clientEmail, privateKey } = getServiceAccount();
  const auth = new JWT({ email: clientEmail, key: privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const { token } = await auth.getAccessToken();
  if (!token) throw new Error("no google token");
  const tabs = Object.keys(SCHEMA);
  const qs = tabs.map((t) => `ranges=${encodeURIComponent(t)}`).join("&");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${getSheetId()}/values:batchGet?${qs}&majorDimension=ROWS`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`sheet read ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { valueRanges?: { values?: string[][] }[] };
  const out: Record<string, Rows> = {};
  tabs.forEach((tab, i) => {
    const vals = data.valueRanges?.[i]?.values || [];
    const headers = vals[0] || (SCHEMA as Record<string, string[]>)[tab];
    const rows: Rows = [];
    for (let r = 1; r < vals.length; r++) {
      const row: Record<string, string> = {};
      headers.forEach((h, c) => { const v = vals[r][c]; row[h] = v == null ? "" : String(v); });
      rows.push(row);
    }
    out[tab] = rows;
  });
  return out;
}

async function main() {
  const sheet = await readSheet();
  for (const [tab, colsU] of Object.entries(SCHEMA)) {
    const cols = colsU as string[];
    const colDefs = cols.map((c) => `${qi(c)} text not null default ''`).join(", ");
    await sql.query(`create table if not exists ${qi(tab)} (__rowid bigserial primary key, ${colDefs})`);

    const cnt = (await sql.query(`select count(*)::int as n from ${qi(tab)}`)) as { n: number }[];
    if (cnt[0].n > 0) { console.log(`${tab.padEnd(18)} skip (already ${cnt[0].n} rows)`); continue; }

    const rows = sheet[tab] || [];
    if (!rows.length) { console.log(`${tab.padEnd(18)} 0 rows in sheet`); continue; }

    const colList = cols.map(qi).join(", ");
    const tuples: string[] = [];
    const params: string[] = [];
    let p = 1;
    for (const row of rows) {
      tuples.push(`(${cols.map(() => `$${p++}`).join(", ")})`);
      for (const c of cols) params.push(row[c] ?? "");
    }
    await sql.query(`insert into ${qi(tab)} (${colList}) values ${tuples.join(", ")}`, params);
    console.log(`${tab.padEnd(18)} migrated ${rows.length} rows`);
  }
  console.log("\nMIGRATION DONE ✓");
}
main().then(() => process.exit(0)).catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
