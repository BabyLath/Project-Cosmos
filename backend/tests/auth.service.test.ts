import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Prisma singleton before importing the service, since the
// service module reads `prisma` at call time via the import binding.
vi.mock("../src/config/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    session: { create: vi.fn(), deleteMany: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    passwordResetToken: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "../src/config/prisma";
import {
  login,
  logout,
  hashPassword,
  verifyPassword,
  createPasswordResetToken,
  resetPassword,
  InvalidCredentialsError,
  InvalidResetTokenError,
  AccountInactiveError,
} from "../src/services/auth.service";

const mockedPrisma = vi.mocked(prisma, true);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("password hashing", () => {
  it("hashes a password and verifies it correctly", async () => {
    const hash = await hashPassword("correct-horse-battery-staple1");
    expect(hash).not.toBe("correct-horse-battery-staple1");
    expect(await verifyPassword(hash, "correct-horse-battery-staple1")).toBe(true);
    expect(await verifyPassword(hash, "wrong-password")).toBe(false);
  });
});

describe("login", () => {
  it("throws InvalidCredentialsError when the user does not exist", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    await expect(login("nobody@example.org", "whatever123")).rejects.toThrow(InvalidCredentialsError);
  });

  it("throws InvalidCredentialsError when the password is wrong", async () => {
    const passwordHash = await hashPassword("correct-password1");
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "user@example.org",
      passwordHash,
      fullName: "Test User",
      role: "MEMBER",
      status: "ACTIVE",
    } as never);

    await expect(login("user@example.org", "wrong-password1")).rejects.toThrow(InvalidCredentialsError);
  });

  it("creates a session on successful login", async () => {
    const passwordHash = await hashPassword("correct-password1");
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "user@example.org",
      passwordHash,
      fullName: "Test User",
      role: "MEMBER",
      status: "ACTIVE",
    } as never);
    mockedPrisma.session.create.mockResolvedValue({ id: "s1", userId: "u1" } as never);

    const result = await login("user@example.org", "correct-password1");
    expect(result.session.id).toBe("s1");
    expect(mockedPrisma.session.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "u1" }) })
    );
  });

  it("throws AccountInactiveError for a deactivated account with correct credentials", async () => {
    const passwordHash = await hashPassword("correct-password1");
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "user@example.org",
      passwordHash,
      fullName: "Test User",
      role: "MEMBER",
      status: "INACTIVE",
    } as never);

    await expect(login("user@example.org", "correct-password1")).rejects.toThrow(AccountInactiveError);
    // No session should have been created for a deactivated account.
    expect(mockedPrisma.session.create).not.toHaveBeenCalled();
  });

  it("throws InvalidCredentialsError (not AccountInactiveError) for a deactivated account with the wrong password", async () => {
    const passwordHash = await hashPassword("correct-password1");
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "user@example.org",
      passwordHash,
      fullName: "Test User",
      role: "MEMBER",
      status: "INACTIVE",
    } as never);

    // Status should never be revealed before the password is verified.
    await expect(login("user@example.org", "wrong-password1")).rejects.toThrow(InvalidCredentialsError);
  });
});

describe("logout", () => {
  it("deletes the session row", async () => {
    await logout("s1");
    expect(mockedPrisma.session.deleteMany).toHaveBeenCalledWith({ where: { id: "s1" } });
  });
});

describe("password reset", () => {
  it("returns null for an email that does not exist, without throwing", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    const result = await createPasswordResetToken("nobody@example.org");
    expect(result).toBeNull();
  });

  it("creates a token for an existing user", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({ id: "u1", email: "user@example.org" } as never);
    mockedPrisma.passwordResetToken.create.mockResolvedValue({} as never);

    const result = await createPasswordResetToken("user@example.org");
    expect(result?.userId).toBe("u1");
    expect(result?.rawToken).toHaveLength(64); // 32 bytes, hex-encoded
  });

  it("rejects an expired token", async () => {
    mockedPrisma.passwordResetToken.findUnique.mockResolvedValue({
      id: "t1",
      userId: "u1",
      usedAt: null,
      expiresAt: new Date(Date.now() - 1000), // already expired
    } as never);

    await expect(resetPassword("some-raw-token", "newPassword123")).rejects.toThrow(InvalidResetTokenError);
  });

  it("rejects an already-used token", async () => {
    mockedPrisma.passwordResetToken.findUnique.mockResolvedValue({
      id: "t1",
      userId: "u1",
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 100000),
    } as never);

    await expect(resetPassword("some-raw-token", "newPassword123")).rejects.toThrow(InvalidResetTokenError);
  });

  it("rejects a token that does not exist", async () => {
    mockedPrisma.passwordResetToken.findUnique.mockResolvedValue(null);
    await expect(resetPassword("nonexistent-token", "newPassword123")).rejects.toThrow(InvalidResetTokenError);
  });

  it("updates the password and invalidates the token on success", async () => {
    mockedPrisma.passwordResetToken.findUnique.mockResolvedValue({
      id: "t1",
      userId: "u1",
      usedAt: null,
      expiresAt: new Date(Date.now() + 100000),
    } as never);
    mockedPrisma.$transaction.mockResolvedValue([] as never);

    await resetPassword("valid-raw-token", "newPassword123");
    expect(mockedPrisma.$transaction).toHaveBeenCalled();
  });
});
