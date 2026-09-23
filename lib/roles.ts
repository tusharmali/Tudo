/**
 * Role helpers — pure, safe to import on client or server.
 *
 * superadmin — full control (incl. promoting others to superadmin).
 * hr         — people-ops manager: attendance, day plans, broadcasts, reports,
 *              user management + suspend. Same reach as an admin EXCEPT it can't
 *              mint another superadmin.
 * employee   — regular team member.
 */
import type { Role } from "./types";

/** superadmin OR hr — the "management" tier that runs people-ops surfaces. */
export function isManager(role?: Role | string): boolean {
  return role === "superadmin" || role === "hr";
}

export function isSuperadmin(role?: Role | string): boolean {
  return role === "superadmin";
}

export function roleLabel(role?: Role | string): string {
  return role === "superadmin" ? "Super Admin" : role === "hr" ? "HR Manager" : "Employee";
}
