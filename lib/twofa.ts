/** Email 2FA — one-time codes + the on/off policy flag.
 *  Codes are stored (bcrypt-hashed) in the Settings tab under `otp:<userId>`,
 *  short-lived and single-use, with a small attempt cap. Node runtime. */
import bcrypt from "bcryptjs";
import { allRows, updateWhere, deleteWhere, appendRow } from "./db";
import { getSetting, setSetting } from "./settings";

const KEY = (uid: string) => `otp:${uid}`;
const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

/** Is email 2FA required for new logins? (Off unless an admin turns it on.) */
export async function twofaEnabled(): Promise<boolean> {
  return (await getSetting("security.2fa")) === "true";
}
export async function setTwofaEnabled(on: boolean): Promise<void> {
  await setSetting("security.2fa", on ? "true" : "false");
}

/** Create + store a fresh 6-digit code for the user; returns the plaintext to email. */
export async function issueCode(userId: string): Promise<string> {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const value = JSON.stringify({ h: await bcrypt.hash(code, 8), exp: Date.now() + TTL_MS, n: 0 });
  const changed = await updateWhere("Settings", (r) => r.key === KEY(userId), { value });
  if (!changed) await appendRow("Settings", { key: KEY(userId), value });
  return code;
}

/** Check a code. Consumes it on success; counts attempts; expires after TTL. */
export async function verifyCode(userId: string, code: string): Promise<boolean> {
  const row = (await allRows("Settings")).find((r) => r.key === KEY(userId));
  if (!row) return false;
  let d: { h: string; exp: number; n: number };
  try {
    d = JSON.parse(row.value);
  } catch {
    return false;
  }
  if (Date.now() > d.exp || d.n >= MAX_ATTEMPTS) {
    await deleteWhere("Settings", (r) => r.key === KEY(userId));
    return false;
  }
  if (await bcrypt.compare(code, d.h)) {
    await deleteWhere("Settings", (r) => r.key === KEY(userId));
    return true;
  }
  await updateWhere("Settings", (r) => r.key === KEY(userId), { value: JSON.stringify({ ...d, n: d.n + 1 }) });
  return false;
}
