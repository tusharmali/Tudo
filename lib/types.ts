export type Role = "superadmin" | "director" | "hr" | "deptadmin" | "employee";

export interface User {
  id: string;
  name: string;
  handle: string;
  email: string;
  role: Role;
  department: string;
  manageDepts: string; // extra departments this user administers the day plan for (comma-sep)
  avatarColor: string;
  avatar: string; // uploaded display picture (data URL), or "" for initials
  phone?: string;
  status?: string;
  remote?: string; // "true" = remote/WFH worker: checks in from anywhere, marked WFH
}

/** The compact user object stored inside the signed session cookie. */
export interface SessionUser {
  sub: string; // user id
  name: string;
  handle: string;
  role: Role;
  dept: string;
  manageDepts?: string; // extra departments this user administers (comma-sep)
  color: string;
  avatar?: string; // display picture, refreshed from the DB each request
  remote?: string; // "true" = remote/WFH worker, refreshed from the DB each request
}
