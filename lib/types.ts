export type Role = "superadmin" | "director" | "hr" | "employee";

export interface User {
  id: string;
  name: string;
  handle: string;
  email: string;
  role: Role;
  department: string;
  avatarColor: string;
  phone?: string;
  status?: string;
}

/** The compact user object stored inside the signed session cookie. */
export interface SessionUser {
  sub: string; // user id
  name: string;
  handle: string;
  role: Role;
  dept: string;
  color: string;
}
