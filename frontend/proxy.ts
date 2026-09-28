import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "oms_session";
const PROTECTED_PREFIXES = ["/dashboard", "/members"];

/**
 * This only checks whether a session cookie is *present*, not whether
 * it's valid — a database round trip on every request isn't worth it
 * here. It exists purely so a logged-out user is redirected before a
 * protected page's shell even loads (fast, avoids layout flicker).
 *
 * The real check is server-side: protected pages call
 * getServerSession() (lib/session.ts), and the backend API validates
 * the session against the database on every request via requireAuth.
 * A forged or expired cookie value still gets rejected there — this
 * function is a UX convenience, not the security boundary (see
 * CVE-2025-29927, why Next.js renamed middleware to proxy: framework
 * routing layers should never be the sole auth gate).
 */
export function proxy(request: NextRequest) {
  const isProtected = PROTECTED_PREFIXES.some((prefix) => request.nextUrl.pathname.startsWith(prefix));
  if (!isProtected) return NextResponse.next();

  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);
  if (!hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/members/:path*"],
};
