/**
 * Add any column declared in lib/schema.ts that a table is missing in Neon.
 *   npx tsx scripts/ensure-columns.ts
 * Complements ensure-tables.ts (which only creates whole tables). Idempotent —
 * safe to run whenever the schema gains a new column. All columns are TEXT
 * NOT NULL DEFAULT '' so existing rows get a sensible blank value.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { neon } from "@neondatabase/serverless";
import { SCHEMA } from "../lib/schema";

const sql = neon(process.env.DATABASE_URL!);
const qi = (s: string) => `"${s.replace(/"/g, '""')}"`;

async function main() {
  for (const [tab, colsU] of Object.entries(SCHEMA)) {
    const cols = colsU as string[];
    // Which columns already exist on this table?
    const existing = (await sql.query(
      `select column_name from information_schema.columns where table_name = $1`,
      [tab],
    )) as { column_name: string }[];
    const have = new Set(existing.map((r) => r.column_name));
    if (!have.size) {
      console.log(`skip ${tab} (table not created yet — run ensure-tables first)`);
      continue;
    }
    for (const c of cols) {
      if (have.has(c)) continue;
      await sql.query(`alter table ${qi(tab)} add column if not exists ${qi(c)} text not null default ''`);
      console.log(`+ ${tab}.${c}`);
    }
  }
  console.log("done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
