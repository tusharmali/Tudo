/**
 * Environment access (Node runtime only — do NOT import from Edge middleware).
 * Resolves the Google service-account credentials from either the recommended
 * base64 blob or the split email/key pair.
 */

export function getSheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error("GOOGLE_SHEET_ID is not set. See .env.local.example.");
  return id.trim();
}

export function getServiceAccount(): { clientEmail: string; privateKey: string } {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_B64;
  if (b64) {
    let parsed: { client_email?: string; private_key?: string };
    try {
      parsed = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    } catch {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_B64 is not valid base64 of a JSON key.");
    }
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error("Service-account JSON is missing client_email or private_key.");
    }
    return { clientEmail: parsed.client_email, privateKey: parsed.private_key };
  }

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) {
    throw new Error(
      "No Google credentials found. Set GOOGLE_SERVICE_ACCOUNT_B64 (recommended) " +
        "or GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY in .env.local.",
    );
  }
  return { clientEmail, privateKey };
}
