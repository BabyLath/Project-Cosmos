import { Request, Response, NextFunction } from "express";

/**
 * Simple fixed-window, in-memory rate limiter keyed by IP + email.
 *
 * This is intentionally minimal for a single-process student project.
 * It resets on server restart and doesn't share state across multiple
 * instances — fine for coursework deployment, but the first thing to
 * swap for a Redis-backed limiter (e.g. `rate-limiter-flexible`) if
 * this ever runs behind a load balancer or needs to survive restarts.
 */
function createRateLimiter(options: { windowMs: number; max: number; message: string }) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const emailPart = typeof req.body?.email === "string" ? req.body.email.toLowerCase() : "";
    const key = `${req.ip}:${emailPart}`;
    const now = Date.now();

    const entry = hits.get(key);
    if (!entry || entry.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    if (entry.count >= options.max) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSec));
      return res.status(429).json({ error: options.message });
    }

    entry.count += 1;
    next();
  };
}

export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts. Try again in a few minutes.",
});

export const forgotPasswordRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Too many password reset requests. Try again later.",
});
