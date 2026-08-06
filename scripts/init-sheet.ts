/**
 * One-command backend provisioner.
 *   npm run init-sheet
 *
 * Reads .env.local, connects to your Google Sheet with the service account,
 * creates every tab + header defined in lib/schema.ts, seeds default config,
 * and (optionally) creates your first super-admin login.
 * Safe to re-run — it only adds what's missing.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import bcrypt from "bcryptjs";
import { SCHEMA, SETTINGS_DEFAULTS, ATTENDANCE_CONFIG_DEFAULTS } from "../lib/schema";
import { getServiceAccount, getSheetId } from "../lib/env";

async function main() {
  const { clientEmail, privateKey } = getServiceAccount();
  const auth = new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const doc = new GoogleSpreadsheet(getSheetId(), auth);
  await doc.loadInfo();
  console.log(`\n📄 Connected to: "${doc.title}"\n`);

  // 1. Ensure every tab + header exists.
  for (const [title, headers] of Object.entries(SCHEMA)) {
    const existing = doc.sheetsByTitle[title];
    if (!existing) {
      await doc.addSheet({ title, headerValues: headers });
      console.log(`  + created tab   ${title}`);
    } else {
      await existing.setHeaderRow(headers);
      console.log(`  = ensured tab   ${title}`);
    }
  }

  // 2. Remove the default "Sheet1" if it's still hanging around.
  const leftover = doc.sheetsByTitle["Sheet1"];
  if (leftover && Object.keys(doc.sheetsByTitle).length > 1) {
    try {
      await leftover.delete();
      console.log("  - removed default Sheet1");
    } catch {
      /* ignore */
    }
  }

  // 3. Seed default settings + attendance config (only missing keys).
  await seedKeyValue("Settings", SETTINGS_DEFAULTS);
  await seedKeyValue("AttendanceConfig", ATTENDANCE_CONFIG_DEFAULTS);

  // 4. Seed the first super-admin from env, if provided.
  const email = String(process.env.SEED_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = String(process.env.SEED_ADMIN_PASSWORD ?? "");
  const name = String(process.env.SEED_ADMIN_NAME ?? "Super Admin").trim();
  const handle = String(process.env.SEED_ADMIN_HANDLE ?? "admin").trim();

  if (email && password) {
    const users = doc.sheetsByTitle["Users"];
    const rows = await users.getRows();
    const exists = rows.some((r) => String(r.get("email") ?? "").trim().toLowerCase() === email);
    if (exists) {
      console.log(`\n  = super-admin already exists: ${email} (left untouched)`);
    } else {
      const passwordHash = await bcrypt.hash(password, 10);
      await users.addRow({
        id: "u_" + Date.now().toString(36),
        name,
        handle,
        email,
        passwordHash,
        role: "superadmin",
        department: "Leadership",
        avatarColor: "#7178DD",
        phone: "",
        status: "active",
        createdAt: new Date().toISOString(),
      });
      console.log(`\n  ✓ seeded super-admin: ${email}`);
    }
  } else {
    console.log("\n  ! No SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD set — skipped creating a login.");
  }

  console.log("\n✅ Done. Your Tudo backend sheet is ready.\n");
}

async function seedKeyValue(tab: string, defaults: Record<string, string>) {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[tab];
  const rows = await sheet.getRows();
  for (const [key, value] of Object.entries(defaults)) {
    if (!rows.some((r) => r.get("key") === key)) {
      await sheet.addRow({ key, value });
    }
  }
}

// Small cached accessor so seedKeyValue reuses the connection.
let cachedDoc: GoogleSpreadsheet | null = null;
async function getDoc(): Promise<GoogleSpreadsheet> {
  if (cachedDoc) return cachedDoc;
  const { clientEmail, privateKey } = getServiceAccount();
  const auth = new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  cachedDoc = new GoogleSpreadsheet(getSheetId(), auth);
  await cachedDoc.loadInfo();
  return cachedDoc;
}

main().catch((e) => {
  console.error("\n❌ Init failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
