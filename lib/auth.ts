/**
 * Password + current-user helpers (Node runtime only — uses bcryptjs and
 * next/headers cookies()). Never import this from the Edge middleware.
 */
import bcrypt from "bcryptjs";
import { cache } from "react";
import { cookies } from "next/headers";
import { COOKIE_NAME, verifySession } from "./session";
import { getUserById } from "./users";
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

/**
 * Read + verify the session cookie, then refresh the mutable fields (role,
 * department, name, …) from the live DB — so an admin changing someone's
 * department or role takes effect on their next page load, no re-login needed.
 * Suspended users are treated as signed out. Wrapped in React `cache` so it runs
 * at most once per request. Node runtime only (do not call from Edge middleware).
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;

  try {
    const fresh = await getUserById(session.sub);
    if (!fresh) return session; // record missing — trust the token rather than lock out
    if ((fresh.status || "active") === "suspended") return null; // suspended → signed out
    return {
      sub: session.sub,
      name: fresh.name,
      handle: fresh.handle,
      role: fresh.role,
      dept: fresh.department,
      color: fresh.avatarColor,
      avatar: fresh.avatar,
    };
  } catch {
    return session; // transient DB issue — keep the user signed in with cached claims
  }
});
