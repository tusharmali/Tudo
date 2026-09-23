/**
 * Provision the Zoxo backend spreadsheet.
 *   npm run init-zoxo
 *
 * Creates every tab + header defined in lib/zoxo-schema.ts, freezes the header
 * row, seeds Config defaults and removes the placeholder "Sheet1".
 * Safe to re-run — it only adds what is missing.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { ZOXO_SCHEMA, ZOXO_CONFIG_DEFAULTS } from "../lib/zoxo-schema";
import { getServiceAccount } from "../lib/env";

async function main() {
  const sheetId = (process.env.ZOXO_SHEET_ID || "").trim();
  if (!sheetId) {
    console.error("\nZOXO_SHEET_ID is not set in .env.local — add it and run again.\n");
    process.exit(1);
  }
  const { clientEmail, privateKey } = getServiceAccount();
  const auth = new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const doc = new GoogleSpreadsheet(sheetId, auth);
  await doc.loadInfo();
  console.log(`\nConnected to: "${doc.title}"`);
  console.log(`Service account: ${clientEmail}\n`);

  for (const [title, headers] of Object.entries(ZOXO_SCHEMA)) {
    const existing = doc.sheetsByTitle[title];
    if (!existing) {
      const sheet = await doc.addSheet({ title, headerValues: headers });
      await sheet.updateProperties({
        gridProperties: { ...sheet.gridProperties, frozenRowCount: 1 },
      });
      console.log(`  + created tab   ${title}  (${headers.length} columns)`);
    } else {
      await existing.setHeaderRow(headers);
      await existing.updateProperties({
        gridProperties: { ...existing.gridProperties, frozenRowCount: 1 },
      });
      console.log(`  = ensured tab   ${title}  (${headers.length} columns)`);
    }
  }

  // Seed Config defaults (only keys that are missing).
  const configSheet = doc.sheetsByTitle.Config;
  const rows = await configSheet.getRows();
  const have = new Set(rows.map((r) => String(r.get("key"))));
  const toAdd = Object.entries(ZOXO_CONFIG_DEFAULTS)
    .filter(([key]) => !have.has(key))
    .map(([key, value]) => ({ key, value }));
  if (toAdd.length) {
    // raw: Sheets would otherwise turn "true" into a boolean cell.
    await configSheet.addRows(toAdd, { raw: true });
    console.log(`  + seeded ${toAdd.length} config key(s)`);
  }

  // Drop the default placeholder tab if the real tabs exist.
  const leftover = doc.sheetsByTitle["Sheet1"];
  if (leftover && Object.keys(doc.sheetsByTitle).length > 1) {
    try {
      await leftover.delete();
      console.log("  - removed placeholder Sheet1");
    } catch {
      console.log("  ! could not remove Sheet1 (delete it by hand if you like)");
    }
  }

  console.log("\nZoxo backend ready.");
  console.log(`Sheet: https://docs.google.com/spreadsheets/d/${sheetId}/edit`);
  const key = (process.env.ZOXO_INGEST_KEY || "").trim();
  console.log(
    key
      ? "Ingest key is set — give it to your testers along with the endpoint URL."
      : "No ZOXO_INGEST_KEY set: the ingest endpoints are open. Set one before going live.",
  );
  console.log("");
}

main().catch((err) => {
  console.error("\nFailed:", err.message, "\n");
  process.exit(1);
});
