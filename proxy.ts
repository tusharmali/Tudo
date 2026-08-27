/**
 * Proxy (Next.js 16 — formerly "middleware"). Runs on every matched request
 * and performs an OPTIMISTIC auth check: it only reads + verifies the signed
 * session cookie (no DB / sheet calls). Real authorization happens in Server
 * Actions, Route Handlers, and the data layer.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, verifySession } from "@/lib/session";

// "/zoxo" holds the Zoxo extension's privacy policy, which the Chrome Web Store
// requires to be publicly reachable without signing in.
const PUBLIC_PATHS = ["/login", "/zoxo"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  // Not signed in → send to login (remember where they were going).
  if (!session && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    return NextResponse.redirect(url);
  }

  // Already signed in but on a sign-in page → send to the dashboard. Other
  // public pages (the Zoxo privacy policy) stay reachable either way.
  const isSignInPage = pathname === "/login" || pathname.startsWith("/login/");
  if (session && isSignInPage) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
