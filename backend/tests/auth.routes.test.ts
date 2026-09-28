import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../src/config/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    session: { create: vi.fn(), deleteMany: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    passwordResetToken: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../src/services/auth.service", async () => {
  const actual = await vi.importActual<typeof import("../src/services/auth.service")>(
    "../src/services/auth.service"
  );
  return {
    ...actual,
    login: vi.fn(),
    logout: vi.fn(),
    getSessionUser: vi.fn(),
    createPasswordResetToken: vi.fn(),
    resetPassword: vi.fn(),
  };
});
vi.mock("../src/services/member.service", () => ({}));
vi.mock("../src/services/email.service", () => ({
  sendPasswordResetEmail: vi.fn(),
  sendMemberInviteEmail: vi.fn(),
}));

import { app } from "../src/server";
import * as authService from "../src/services/auth.service";

const mockedAuthService = vi.mocked(authService, true);

beforeEach(() => {
  vi.clearAllMocks();
});

// requireCsrfHeader expects this on every state-changing request.
const csrf = { "X-Requested-With": "oms-frontend" };

describe("POST /api/auth/login", () => {
  it("rejects requests without the CSRF header", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "a@b.com", password: "x" });
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid input", async () => {
    const res = await request(app).post("/api/auth/login").set(csrf).send({ email: "not-an-email" });
    expect(res.status).toBe(400);
  });

  it("returns 401 with a generic message on invalid credentials", async () => {
    mockedAuthService.login.mockRejectedValue(new authService.InvalidCredentialsError());

    const res = await request(app)
      .post("/api/auth/login")
      .set(csrf)
      .send({ email: "user@example.org", password: "wrong" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password");
  });

  it("returns 403 for a deactivated account", async () => {
    mockedAuthService.login.mockRejectedValue(new authService.AccountInactiveError());

    const res = await request(app)
      .post("/api/auth/login")
      .set(csrf)
      .send({ email: "user@example.org", password: "correct1" });

    expect(res.status).toBe(403);
  });

  it("sets a session cookie and returns the user on success", async () => {
    mockedAuthService.login.mockResolvedValue({
      user: { id: "u1", email: "user@example.org", fullName: "Test User", role: "MEMBER" },
      session: { id: "s1", userId: "u1", expiresAt: new Date(), createdAt: new Date() },
    } as never);

    const res = await request(app)
      .post("/api/auth/login")
      .set(csrf)
      .send({ email: "user@example.org", password: "correct1", rememberMe: true });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("user@example.org");
    expect(res.body.user.passwordHash).toBeUndefined(); // never leak the hash
    expect(res.headers["set-cookie"]?.[0]).toContain("oms_session=");
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 with no session cookie", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 for an invalid/expired session", async () => {
    mockedAuthService.getSessionUser.mockResolvedValue(null);
    const res = await request(app).get("/api/auth/me").set("Cookie", "oms_session=bad-session-id");
    expect(res.status).toBe(401);
  });

  it("returns the user for a valid session", async () => {
    mockedAuthService.getSessionUser.mockResolvedValue({
      id: "u1",
      email: "user@example.org",
      fullName: "Test User",
      role: "MEMBER",
      status: "ACTIVE",
    } as never);

    const res = await request(app).get("/api/auth/me").set("Cookie", "oms_session=good-session-id");
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("user@example.org");
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the session cookie", async () => {
    const res = await request(app).post("/api/auth/logout").set(csrf).set("Cookie", "oms_session=s1");
    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"]?.[0]).toMatch(/oms_session=;/);
  });
});

describe("POST /api/auth/forgot-password", () => {
  it("returns the same message whether or not the email exists", async () => {
    mockedAuthService.createPasswordResetToken.mockResolvedValue(null);
    const res1 = await request(app).post("/api/auth/forgot-password").set(csrf).send({ email: "ghost@example.org" });

    mockedAuthService.createPasswordResetToken.mockResolvedValue({ rawToken: "raw", userId: "u1" });
    const res2 = await request(app).post("/api/auth/forgot-password").set(csrf).send({ email: "real@example.org" });

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.body.message).toBe(res2.body.message);
  });
});

describe("POST /api/auth/reset-password", () => {
  it("returns 400 for an invalid or expired token", async () => {
    mockedAuthService.resetPassword.mockRejectedValue(new authService.InvalidResetTokenError());

    const res = await request(app)
      .post("/api/auth/reset-password")
      .set(csrf)
      .send({ token: "bad", password: "newPass123", confirmPassword: "newPass123" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when passwords do not match, before hitting the service", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .set(csrf)
      .send({ token: "abc", password: "newPass123", confirmPassword: "different1" });

    expect(res.status).toBe(400);
    expect(mockedAuthService.resetPassword).not.toHaveBeenCalled();
  });
});
