"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findUserByEmail } from "@/lib/users";
import { verifyPassword } from "@/lib/auth";
import { signSession, COOKIE_NAME, cookieOptions } from "@/lib/session";

export type LoginState = { error?: string } | undefined;

function safeNext(n: string): string {
  return n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? "/dashboard"));

  if (!email || !password) return { error: "Enter your email and password." };

  let found;
  try {
    found = await findUserByEmail(email);
  } catch (e) {
    console.error("login: user lookup failed", e);
    return { error: "Server isn't configured yet — initialize the sheet and set your env vars, then try again." };
  }

  if (!found) return { error: "Invalid email or password." };
  if (found.status && found.status !== "active") {
    return { error: "Your account is inactive. Contact your admin." };
  }
  const ok = await verifyPassword(password, found.passwordHash);
  if (!ok) return { error: "Invalid email or password." };

  const u = found.user;
  const token = await signSession({
    sub: u.id,
    name: u.name,
    handle: u.handle,
    role: u.role,
    dept: u.department,
    color: u.avatarColor,
  });
  (await cookies()).set(COOKIE_NAME, token, cookieOptions());

  redirect(next);
}

export async function logout() {
  (await cookies()).set(COOKIE_NAME, "", { ...cookieOptions(), maxAge: 0 });
  redirect("/login");
}
