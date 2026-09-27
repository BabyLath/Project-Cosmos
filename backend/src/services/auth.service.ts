import argon2 from "argon2";
import crypto from "node:crypto";
import { prisma } from "../config/prisma";
import { env } from "../config/env";

const SESSION_TTL_MS = env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = env.RESET_TOKEN_TTL_MINUTES * 60 * 1000;

export class InvalidCredentialsError extends Error {}
export class InvalidResetTokenError extends Error {}

export async function hashPassword(plain: string): Promise<string> {
  // argon2id: resistant to both GPU cracking and side-channel attacks,
  // the current OWASP-recommended default over bcrypt.
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}

/**
 * Verifies credentials and creates a new session row.
 * Throws InvalidCredentialsError for both "no such user" and "wrong
 * password" so the API response can't be used to enumerate accounts.
 */
export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // Still run a hash comparison against a dummy value so this path
    // takes roughly the same time as the "user exists" path, which
    // makes timing-based user enumeration harder.
    await argon2.hash(password).catch(() => undefined);
    throw new InvalidCredentialsError();
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    throw new InvalidCredentialsError();
  }

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });

  return { user, session };
}

export async function logout(sessionId: string) {
  // deleteMany rather than delete: silently no-ops if the session was
  // already removed (expired cleanup, double logout click), instead
  // of throwing.
  await prisma.session.deleteMany({ where: { id: sessionId } });
}

export async function getSessionUser(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return session.user;
}

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Always resolves (never throws for "email not found") so the caller
 * can return an identical response whether or not the account exists.
 * Returns the raw token only when a user was actually found, so the
 * email-sending step happens exactly once, for real accounts only.
 */
export async function createPasswordResetToken(email: string): Promise<{ rawToken: string; userId: string } | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;

  const rawToken = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  return { rawToken, userId: user.id };
}

export async function resetPassword(rawToken: string, newPassword: string) {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new InvalidResetTokenError();
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Log out every existing session on password reset — if the reset
    // was triggered because credentials leaked, this closes any
    // session an attacker may already hold.
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);
}
