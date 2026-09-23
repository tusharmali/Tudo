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

export function parseDepts(s?: string): string[] {
  return (s || "").split(",").map((x) => x.trim()).filter(Boolean);
}

type DeptUser = { role?: Role | string; department?: string; dept?: string; manageDepts?: string };

/** Departments a non-manager administers the day plan for: their own (if a
 *  dept admin) plus any explicitly assigned extra departments. Managers manage
 *  everyone, so this is only meaningful for non-managers. */
export function manageDeptsOf(user: DeptUser): string[] {
  const own = user.department ?? user.dept ?? "";
  const set = new Set<string>(parseDepts(user.manageDepts));
  if (isDeptAdmin(user.role) && own) set.add(own);
  return [...set];
}

/** Can this user build/edit ANY day plan? Managers, dept admins, or anyone
 *  granted extra departments to manage. */
export function canPlan(user: DeptUser): boolean {
  return isManager(user.role) || isDeptAdmin(user.role) || parseDepts(user.manageDepts).length > 0;
}

/** Can `user` manage the day plan for members of `dept`? Managers: any dept. */
export function canManageDept(user: DeptUser, dept: string): boolean {
  if (isManager(user.role)) return true;
  return manageDeptsOf(user).includes(dept);
}

/** The departments whose WIP formats a user can compose (own dept + managed). */
export function wipDeptsFor(user: DeptUser): string[] {
  const own = user.department ?? user.dept ?? "";
  const set = new Set<string>();
  if (own) set.add(own);
  for (const d of parseDepts(user.manageDepts)) set.add(d);
  return [...set];
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
