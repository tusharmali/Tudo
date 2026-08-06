import bcrypt from "bcryptjs";
import { allRows, appendRow, genId, type Row } from "./db";
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
