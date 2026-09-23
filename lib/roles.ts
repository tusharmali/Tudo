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

/** superadmin, director OR hr — the "management" tier with full module access. */
export function isManager(role?: Role | string): boolean {
  return role === "superadmin" || role === "director" || role === "hr";
}

export function isSuperadmin(role?: Role | string): boolean {
  return role === "superadmin";
}

/** A department admin — no manager powers; can only build the day plan for their
 *  own department. */
export function isDeptAdmin(role?: Role | string): boolean {
  return role === "deptadmin";
}

/** Who may build/edit a day plan: full managers + department admins. */
export function canBuildDayPlan(role?: Role | string): boolean {
  return isManager(role) || isDeptAdmin(role);
}

export function roleLabel(role?: Role | string): string {
  return role === "superadmin"
    ? "Super Admin"
    : role === "director"
      ? "Director"
      : role === "hr"
        ? "HR Manager"
        : role === "deptadmin"
          ? "Dept Admin"
          : "Employee";
}
