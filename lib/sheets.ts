/**
 * Google Sheets connection (Node runtime). The loaded document is cached
 * across warm serverless invocations so we don't re-auth on every request.
 */
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { getServiceAccount, getSheetId } from "./env";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

let cached: GoogleSpreadsheet | null = null;

export async function getDoc(): Promise<GoogleSpreadsheet> {
  if (cached) return cached;
  const { clientEmail, privateKey } = getServiceAccount();
  const auth = new JWT({ email: clientEmail, key: privateKey, scopes: SCOPES });
  const doc = new GoogleSpreadsheet(getSheetId(), auth);
  await doc.loadInfo();
  cached = doc;
  return doc;
}

export async function getSheet(title: string) {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[title];
  if (!sheet) {
    throw new Error(`Sheet tab "${title}" not found. Run: npm run init-sheet`);
  }
  return sheet;
}
