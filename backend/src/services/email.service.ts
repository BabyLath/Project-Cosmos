import { env } from "../config/env";

const smtpConfigured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

/**
 * Sends the password reset link. Without SMTP configured, this logs
 * the link to the console instead of pretending to send an email —
 * per project requirements, there is no fake "email sent" response
 * that silently does nothing.
 *
 * To wire up real delivery: install `nodemailer`, configure a
 * transport from the SMTP_* env vars, and replace the body of the
 * `if (!smtpConfigured)` branch below.
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!smtpConfigured) {
    console.log(`[dev email stub] Password reset link for ${to}: ${resetUrl}`);
    return;
  }

  throw new Error(
    "SMTP is configured but no email transport is implemented yet. " +
      "Install nodemailer and complete sendPasswordResetEmail() in email.service.ts."
  );
}

/**
 * Sends a "set your password" link to a newly-created member account.
 * Reuses the exact same reset-token/reset-link mechanism as forgot
 * password (see auth.service.createPasswordResetToken) — a new member
 * never receives a password chosen by an admin, only a link to set
 * their own. Kept as a separate function purely so dev-console logs
 * (and any future email templates) are distinguishable from a normal
 * password reset.
 */
export async function sendMemberInviteEmail(to: string, resetUrl: string): Promise<void> {
  if (!smtpConfigured) {
    console.log(`[dev email stub] Member invitation for ${to} — set your password: ${resetUrl}`);
    return;
  }

  throw new Error(
    "SMTP is configured but no email transport is implemented yet. " +
      "Install nodemailer and complete sendMemberInviteEmail() in email.service.ts."
  );
}
