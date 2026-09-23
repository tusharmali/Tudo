/**
 * Session tokens (JWT via jose). Edge-safe: this module must not use any
 * Node-only API, because the middleware (Edge runtime) imports it.
 */
import { SignJWT, jwtVerify } from "jose";
import type { SessionUser } from "./types";

export const COOKIE_NAME = "tudo_session";
export const PENDING_COOKIE = "tudo_2fa"; // short-lived: an in-progress 2FA challenge
export const TRUST_COOKIE = "tudo_trust"; // long-lived: this device is remembered
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days
export const TRUST_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET must be set (>= 16 chars). Generate: openssl rand -base64 32");
  }
  return new TextEncoder().encode(s);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

/** A short-lived token proving the password step passed, pending the 2FA code. */
export async function signPending(sub: string, email: string): Promise<string> {
  return new SignJWT({ sub, email, kind: "pending" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").sign(secret());
}
export async function verifyPending(token: string): Promise<{ sub: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.kind !== "pending") return null;
    return { sub: String(payload.sub), email: String(payload.email) };
  } catch {
    return null;
  }
}

/** A long-lived token marking this browser as a remembered device (skips 2FA). */
export async function signTrust(sub: string): Promise<string> {
  return new SignJWT({ sub, kind: "trust" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30d").sign(secret());
}
export async function verifyTrust(token: string): Promise<{ sub: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.kind !== "trust") return null;
    return { sub: String(payload.sub) };
  } catch {
    return null;
  }
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE,
  };
}
