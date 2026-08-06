import { getCurrentUser } from "./auth";
import type { SessionUser } from "./types";

/** Use inside Server Actions / Route Handlers to require a signed-in user. */
export async function requireUser(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) throw new Error("You need to sign in.");
  return u;
}

/** Require a super-admin. Throws otherwise. */
export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== "superadmin") throw new Error("You don't have permission to do that.");
  return u;
}
