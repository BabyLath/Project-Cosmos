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
      user?: { id: string; email: string; fullName: string; role: string; status: string };
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

  req.user = { id: user.id, email: user.email, fullName: user.fullName, role: user.role, status: user.status };
  req.sessionId = sessionId;
  next();
}

/**
 * Role-gate for member-management (and future) endpoints. Must run
 * after requireAuth. Never trusts anything the client sends — the
 * role comes from the session row looked up in requireAuth, not from
 * the request body or a header.
 */
export function requireRole(...roles: Array<"ADMIN" | "OFFICER" | "MEMBER">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!roles.includes(req.user.role as "ADMIN" | "OFFICER" | "MEMBER")) {
      return res.status(403).json({ error: "You do not have permission to perform this action." });
    }
    next();
  };
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
