import { Request, Response } from "express";
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validators/auth.validators";
import * as authService from "../services/auth.service";
import { sendPasswordResetEmail } from "../services/email.service";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "../middleware/auth.middleware";
import { env } from "../config/env";

const SESSION_TTL_MS = env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

export async function loginHandler(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
  }

  try {
    const { user, session } = await authService.login(parsed.data.email, parsed.data.password);

    // The session row itself always lives for SESSION_TTL_DAYS on the
    // server — "remember me" only controls whether the *cookie*
    // persists across browser restarts. Unchecked: a session cookie
    // with no maxAge, which the browser discards on close, even
    // though the underlying session would otherwise still be valid.
    const cookieOptions = parsed.data.rememberMe
      ? sessionCookieOptions(SESSION_TTL_MS)
      : { ...sessionCookieOptions(SESSION_TTL_MS), maxAge: undefined };
    res.cookie(SESSION_COOKIE_NAME, session.id, cookieOptions);
    return res.status(200).json({
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    });
  } catch (err) {
    if (err instanceof authService.InvalidCredentialsError) {
      // Deliberately vague: does not say which of email/password was wrong.
      return res.status(401).json({ error: "Invalid email or password" });
    }
    throw err;
  }
}

export async function logoutHandler(req: Request, res: Response) {
  if (req.sessionId) {
    await authService.logout(req.sessionId);
  }
  res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions(0));
  return res.status(200).json({ success: true });
}

export async function meHandler(req: Request, res: Response) {
  // requireAuth middleware has already populated req.user
  return res.status(200).json({ user: req.user });
}

export async function forgotPasswordHandler(req: Request, res: Response) {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
  }

  const result = await authService.createPasswordResetToken(parsed.data.email);
  if (result) {
    const resetUrl = `${env.CORS_ORIGIN}/reset-password/${result.rawToken}`;
    await sendPasswordResetEmail(parsed.data.email, resetUrl);
  }

  // Identical response whether or not the account exists.
  return res.status(200).json({
    message: "If an account with that email exists, a password reset link has been sent.",
  });
}

export async function resetPasswordHandler(req: Request, res: Response) {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
  }

  try {
    await authService.resetPassword(parsed.data.token, parsed.data.password);
    return res.status(200).json({ message: "Password updated. You can now log in." });
  } catch (err) {
    if (err instanceof authService.InvalidResetTokenError) {
      return res.status(400).json({ error: "This reset link is invalid or has expired." });
    }
    throw err;
  }
}
