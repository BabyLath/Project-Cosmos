import { cookies } from "next/headers";
import type { SessionUser } from "./api/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const SESSION_COOKIE_NAME = "oms_session";

/**
 * Server-side session check for use in Server Components and route
 * handlers. Forwards the session cookie to the backend rather than
 * trusting anything client-supplied, since the backend is the only
 * place that can actually validate a session against the database.
 */
export async function getServerSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!sessionCookie) return null;

  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Cookie: `${SESSION_COOKIE_NAME}=${sessionCookie.value}` },
    cache: "no-store",
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.user as SessionUser;
}
