import { Request, Response, NextFunction } from "express";
import { getSessionUser } from "../services/auth.service";
import { isProduction, env } from "../config/env";

export const SESSION_COOKIE_NAME = "oms_session";

export function sessionCookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: isProduction, // requires HTTPS in production
    sameSite: "lax" as const, // CSRF mitigation: not sent on cross-site POSTs
    maxAge: maxAgeMs,
    path: "/",
  };
}

// Augment Express's Request type so controllers get a typed req.user
// instead of `any`.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; email: string; fullName: string; role: string };
      sessionId?: string;
    }
  }
}

/**
 * Backend-side route guard. The frontend also hides protected pages
 * from unauthenticated users, but that's UX only — this middleware is
 * the actual security boundary, since the frontend guard can always
 * be bypassed by calling the API directly.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME];

  if (!sessionId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const user = await getSessionUser(sessionId);
  if (!user) {
    res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions(0));
    return res.status(401).json({ error: "Session expired" });
  }

  req.user = { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
  req.sessionId = sessionId;
  next();
}

/**
 * Basic CSRF check for state-changing requests: browsers won't let
 * cross-origin JS set this header on a fetch, so its presence proves
 * the request came from the app's own frontend code, not a form on
 * another site riding the session cookie.
 */
export function requireCsrfHeader(req: Request, res: Response, next: NextFunction) {
  if (req.headers["x-requested-with"] !== "oms-frontend") {
    return res.status(403).json({ error: "Request rejected" });
  }
  next();
}
