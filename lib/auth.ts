/**
 * Password + current-user helpers (Node runtime only — uses bcryptjs and
 * next/headers cookies()). Never import this from the Edge middleware.
 */
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { COOKIE_NAME, verifySession } from "./session";
import type { SessionUser } from "./types";

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(pw, hash);
  } catch {
    return false;
  }
}

/** Read + verify the session cookie in a Server Component or Route Handler. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}
