import { getCurrentUser } from "./auth";
import { isManager, canBuildDayPlan } from "./roles";
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

/** Require a manager — super-admin, director OR hr. Kept in sync with isManager
 *  so the server gate matches what the UI shows. Used for people-ops surfaces. */
export async function requireManager(): Promise<SessionUser> {
  const u = await requireUser();
  if (!isManager(u.role)) throw new Error("You don't have permission to do that.");
  return u;
}

/** Require a day-plan editor — a manager OR a department admin. */
export async function requireDayPlanEditor(): Promise<SessionUser> {
  const u = await requireUser();
  if (!canBuildDayPlan(u.role)) throw new Error("You don't have permission to do that.");
  return u;
}
