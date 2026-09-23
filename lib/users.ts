import bcrypt from "bcryptjs";
import { allRows, appendRow, updateWhere, genId, type Row } from "./db";
import type { Role, User } from "./types";

const AVATAR_COLORS = ["#7178DD", "#5DBBA0", "#DE7C9A", "#D99A5B", "#5CA0DE", "#9B7AD6", "#3FA98A", "#CE9646"];

function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function rowToUser(r: Row): User {
  return {
    id: r.id || "",
    name: r.name || "",
    handle: r.handle || "",
    email: (r.email || "").trim().toLowerCase(),
    role: (r.role as Role) || "employee",
    department: r.department || "",
    avatarColor: r.avatarColor || "#7178DD",
    phone: r.phone || "",
    status: r.status || "active",
  };
}

export interface FoundUser {
  user: User;
  passwordHash: string;
  status: string;
}

export async function findUserByEmail(email: string): Promise<FoundUser | null> {
  const rows = await allRows("Users");
  const target = email.trim().toLowerCase();
  const row = rows.find((r) => (r.email || "").trim().toLowerCase() === target);
  if (!row) return null;
  return { user: rowToUser(row), passwordHash: row.passwordHash || "", status: row.status || "active" };
}

export async function listUsers(): Promise<User[]> {
  const rows = await allRows("Users");
  return rows.map(rowToUser).filter((u) => u.id);
}

export async function getUserById(id: string): Promise<User | null> {
  const users = await listUsers();
  return users.find((u) => u.id === id) ?? null;
}

/** id → User map, handy for resolving names in chat / concerns. */
export async function usersMap(): Promise<Record<string, User>> {
  const users = await listUsers();
  const map: Record<string, User> = {};
  for (const u of users) map[u.id] = u;
  return map;
}

export interface NewUser {
  name: string;
  email: string;
  password: string;
  role: Role;
  department?: string;
  handle?: string;
  phone?: string;
}

export async function createUser(input: NewUser): Promise<User> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password || !input.name.trim()) {
    throw new Error("Name, email and password are required.");
  }
  const existing = await findUserByEmail(email);
  if (existing) throw new Error("A user with that email already exists.");

  const passwordHash = await bcrypt.hash(input.password, 10);
  const handle = (input.handle || input.name.trim().split(/\s+/)[0]).replace(/^@/, "");
  const user: User = {
    id: genId("u"),
    name: input.name.trim(),
    handle,
    email,
    role: input.role,
    department: input.department?.trim() || "",
    avatarColor: colorFor(email),
    phone: input.phone?.trim() || "",
    status: "active",
  };

  await appendRow("Users", {
    id: user.id,
    name: user.name,
    handle: user.handle,
    email: user.email,
    passwordHash,
    role: user.role,
    department: user.department,
    avatarColor: user.avatarColor,
    phone: user.phone ?? "",
    status: "active",
    createdAt: new Date().toISOString(),
  });
  return user;
}

/** Manager: suspend / reactivate a user (suspended users can't sign in). */
export async function setUserStatus(userId: string, status: "active" | "suspended"): Promise<void> {
  const changed = await updateWhere("Users", (r) => r.id === userId, { status });
  if (!changed) throw new Error("User not found.");
}

/** Super-admin: change a user's role. */
export async function setUserRole(userId: string, role: Role): Promise<void> {
  const changed = await updateWhere("Users", (r) => r.id === userId, { role });
  if (!changed) throw new Error("User not found.");
}

/** Manager: move a user to a department. */
export async function setUserDepartment(userId: string, department: string): Promise<void> {
  const changed = await updateWhere("Users", (r) => r.id === userId, { department: department.trim() });
  if (!changed) throw new Error("User not found.");
}

/** Admin: set a user's password directly (reset — no current-password check). */
export async function setPassword(userId: string, newPassword: string): Promise<void> {
  if (!newPassword || newPassword.length < 6) throw new Error("Password must be at least 6 characters.");
  const hash = await bcrypt.hash(newPassword, 10);
  const changed = await updateWhere("Users", (r) => r.id === userId, { passwordHash: hash });
  if (!changed) throw new Error("User not found.");
}

/** Self: change your own password after verifying the current one. */
export async function verifyAndSetPassword(userId: string, current: string, next: string): Promise<void> {
  if (!next || next.length < 6) throw new Error("New password must be at least 6 characters.");
  const rows = await allRows("Users");
  const row = rows.find((r) => r.id === userId);
  if (!row) throw new Error("User not found.");
  const ok = await bcrypt.compare(current, row.passwordHash || "");
  if (!ok) throw new Error("Your current password is incorrect.");
  const hash = await bcrypt.hash(next, 10);
  await updateWhere("Users", (r) => r.id === userId, { passwordHash: hash });
}
