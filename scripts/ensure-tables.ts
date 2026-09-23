/**
 * Create any table declared in lib/schema.ts that doesn't exist yet in Neon.
 *   npx tsx scripts/ensure-tables.ts
 * Idempotent — safe to run whenever the schema gains a new tab.
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
    const colDefs = cols.map((c) => `${qi(c)} text not null default ''`).join(", ");
    await sql.query(`create table if not exists ${qi(tab)} (__rowid bigserial primary key, ${colDefs})`);
    console.log(`ok: ${tab}`);
  }
  console.log("DONE ✓");
}
main().then(() => process.exit(0)).catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
