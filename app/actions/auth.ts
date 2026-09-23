"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findUserByEmail, getUserById } from "@/lib/users";
import { verifyPassword } from "@/lib/auth";
import {
  signSession,
  signPending,
  verifyPending,
  signTrust,
  verifyTrust,
  COOKIE_NAME,
  PENDING_COOKIE,
  TRUST_COOKIE,
  TRUST_MAX_AGE,
  cookieOptions,
} from "@/lib/session";
import { twofaEnabled, issueCode, verifyCode } from "@/lib/twofa";
import { sendEmail, otpEmailHtml } from "@/lib/email";
import type { User } from "@/lib/types";

export type LoginState = { error?: string; twofa?: boolean; email?: string } | undefined;

function safeNext(n: string): string {
  return n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
}

async function mintSession(u: User): Promise<void> {
  const token = await signSession({
    sub: u.id,
    name: u.name,
    handle: u.handle,
    role: u.role,
    dept: u.department,
    color: u.avatarColor,
  });
  (await cookies()).set(COOKIE_NAME, token, cookieOptions());
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
    return { error: "Server isn't configured yet — set your database and env vars, then try again." };
  }

  if (!found) return { error: "Invalid email or password." };
  if (found.status && found.status !== "active") {
    return { error: "Your account is suspended. Contact your admin." };
  }
  const ok = await verifyPassword(password, found.passwordHash);
  if (!ok) return { error: "Invalid email or password." };

  const u = found.user;
  const store = await cookies();

  // Email 2FA gate — only when enabled, and only on a device we don't already trust.
  if (await twofaEnabled()) {
    const trust = store.get(TRUST_COOKIE)?.value;
    const trusted = trust ? (await verifyTrust(trust))?.sub === u.id : false;
    if (!trusted) {
      const code = await issueCode(u.id);
      const sent = await sendEmail(u.email, "Your Tudo sign-in code", otpEmailHtml(code));
      if (!sent.ok) return { error: "Couldn't email your sign-in code. Contact an admin." };
      store.set(PENDING_COOKIE, await signPending(u.id, u.email), { ...cookieOptions(), maxAge: 600 });
      return { twofa: true, email: u.email };
    }
  }

  await mintSession(u);
  redirect(next);
}

export async function verifyOtp(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const code = String(formData.get("code") ?? "").trim();
  const remember = String(formData.get("remember") ?? "") === "on";
  const next = safeNext(String(formData.get("next") ?? "/dashboard"));
  const store = await cookies();

  const pendingTok = store.get(PENDING_COOKIE)?.value;
  const pending = pendingTok ? await verifyPending(pendingTok) : null;
  if (!pending) return { error: "Your sign-in session expired. Please start again." };
  if (!/^\d{6}$/.test(code)) return { twofa: true, email: pending.email, error: "Enter the 6-digit code from your email." };

  const good = await verifyCode(pending.sub, code);
  if (!good) return { twofa: true, email: pending.email, error: "That code is invalid or expired." };

  const u = await getUserById(pending.sub);
  if (!u) return { error: "Account not found." };

  await mintSession(u);
  store.delete(PENDING_COOKIE);
  if (remember) store.set(TRUST_COOKIE, await signTrust(u.id), { ...cookieOptions(), maxAge: TRUST_MAX_AGE });
  redirect(next);
}

export async function logout() {
  (await cookies()).set(COOKIE_NAME, "", { ...cookieOptions(), maxAge: 0 });
  redirect("/login");
}
