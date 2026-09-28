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
  return { ...actual, getSessionUser: vi.fn() };
});

vi.mock("../src/services/member.service", () => ({
  listMembers: vi.fn(),
  getMemberById: vi.fn(),
  createMember: vi.fn(),
  updateMember: vi.fn(),
  updateMemberStatus: vi.fn(),
  DuplicateEmailError: class DuplicateEmailError extends Error {},
  MemberNotFoundError: class MemberNotFoundError extends Error {},
}));

vi.mock("../src/services/email.service", () => ({
  sendPasswordResetEmail: vi.fn(),
  sendMemberInviteEmail: vi.fn(),
}));

import { app } from "../src/server";
import * as authService from "../src/services/auth.service";
import * as memberService from "../src/services/member.service";

const mockedAuthService = vi.mocked(authService, true);
const mockedMemberService = vi.mocked(memberService, true);

const csrf = { "X-Requested-With": "oms-frontend" };

function sessionAs(role: "ADMIN" | "OFFICER" | "MEMBER", id = "actor-1") {
  mockedAuthService.getSessionUser.mockResolvedValue({
    id,
    email: `${role.toLowerCase()}@example.org`,
    fullName: `${role} User`,
    role,
    status: "ACTIVE",
  } as never);
  return { Cookie: `oms_session=${role}-session` };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/members", () => {
  it("rejects an unauthenticated request", async () => {
    const res = await request(app).get("/api/members");
    expect(res.status).toBe(401);
  });

  it("rejects a MEMBER", async () => {
    const cookie = sessionAs("MEMBER");
    const res = await request(app).get("/api/members").set(cookie);
    expect(res.status).toBe(403);
  });

  it("allows an OFFICER to list members", async () => {
    const cookie = sessionAs("OFFICER");
    mockedMemberService.listMembers.mockResolvedValue({
      members: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
    } as never);

    const res = await request(app).get("/api/members").set(cookie);
    expect(res.status).toBe(200);
  });

  it("allows an ADMIN to list members", async () => {
    const cookie = sessionAs("ADMIN");
    mockedMemberService.listMembers.mockResolvedValue({
      members: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
    } as never);

    const res = await request(app).get("/api/members").set(cookie);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/members", () => {
  it("rejects an OFFICER attempting to create an ADMIN account", async () => {
    const cookie = sessionAs("OFFICER");
    const res = await request(app)
      .post("/api/members")
      .set(cookie)
      .set(csrf)
      .send({ fullName: "New Admin", email: "newadmin@example.org", role: "ADMIN" });

    expect(res.status).toBe(403);
    expect(mockedMemberService.createMember).not.toHaveBeenCalled();
  });

  it("allows an ADMIN to create an ADMIN account", async () => {
    const cookie = sessionAs("ADMIN");
    mockedMemberService.createMember.mockResolvedValue({
      id: "u2",
      fullName: "New Admin",
      email: "newadmin@example.org",
      role: "ADMIN",
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const res = await request(app)
      .post("/api/members")
      .set(cookie)
      .set(csrf)
      .send({ fullName: "New Admin", email: "newadmin@example.org", role: "ADMIN" });

    expect(res.status).toBe(201);
  });

  it("returns 409 on a duplicate email", async () => {
    const cookie = sessionAs("ADMIN");
    mockedMemberService.createMember.mockRejectedValue(new memberService.DuplicateEmailError());

    const res = await request(app)
      .post("/api/members")
      .set(cookie)
      .set(csrf)
      .send({ fullName: "Dup", email: "dup@example.org", role: "MEMBER" });

    expect(res.status).toBe(409);
  });
});

describe("PATCH /api/members/:id", () => {
  it("rejects a user changing their own role", async () => {
    const cookie = sessionAs("ADMIN", "self-1");
    const res = await request(app)
      .patch("/api/members/self-1")
      .set(cookie)
      .set(csrf)
      .send({ role: "OFFICER" });

    expect(res.status).toBe(403);
    expect(mockedMemberService.updateMember).not.toHaveBeenCalled();
  });

  it("rejects an OFFICER granting ADMIN to someone else", async () => {
    const cookie = sessionAs("OFFICER", "officer-1");
    const res = await request(app)
      .patch("/api/members/other-1")
      .set(cookie)
      .set(csrf)
      .send({ role: "ADMIN" });

    expect(res.status).toBe(403);
  });

  it("rejects an OFFICER editing an existing ADMIN's role", async () => {
    const cookie = sessionAs("OFFICER", "officer-1");
    mockedMemberService.getMemberById.mockResolvedValue({
      id: "admin-1",
      fullName: "Boss",
      email: "boss@example.org",
      role: "ADMIN",
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const res = await request(app)
      .patch("/api/members/admin-1")
      .set(cookie)
      .set(csrf)
      .send({ role: "MEMBER" });

    expect(res.status).toBe(403);
  });

  it("allows an OFFICER to promote a MEMBER to OFFICER", async () => {
    const cookie = sessionAs("OFFICER", "officer-1");
    mockedMemberService.getMemberById.mockResolvedValue({
      id: "member-1",
      fullName: "Regular Member",
      email: "member@example.org",
      role: "MEMBER",
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    mockedMemberService.updateMember.mockResolvedValue({
      id: "member-1",
      fullName: "Regular Member",
      email: "member@example.org",
      role: "OFFICER",
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const res = await request(app)
      .patch("/api/members/member-1")
      .set(cookie)
      .set(csrf)
      .send({ role: "OFFICER" });

    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/members/:id/status", () => {
  it("rejects an OFFICER (deactivation is ADMIN-only)", async () => {
    const cookie = sessionAs("OFFICER");
    const res = await request(app)
      .patch("/api/members/u1/status")
      .set(cookie)
      .set(csrf)
      .send({ status: "INACTIVE" });

    expect(res.status).toBe(403);
    expect(mockedMemberService.updateMemberStatus).not.toHaveBeenCalled();
  });

  it("rejects an ADMIN deactivating their own account", async () => {
    const cookie = sessionAs("ADMIN", "admin-1");
    const res = await request(app)
      .patch("/api/members/admin-1/status")
      .set(cookie)
      .set(csrf)
      .send({ status: "INACTIVE" });

    expect(res.status).toBe(403);
    expect(mockedMemberService.updateMemberStatus).not.toHaveBeenCalled();
  });

  it("allows an ADMIN to deactivate another member", async () => {
    const cookie = sessionAs("ADMIN", "admin-1");
    mockedMemberService.updateMemberStatus.mockResolvedValue({
      id: "member-1",
      fullName: "Regular Member",
      email: "member@example.org",
      role: "MEMBER",
      status: "INACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const res = await request(app)
      .patch("/api/members/member-1/status")
      .set(cookie)
      .set(csrf)
      .send({ status: "INACTIVE" });

    expect(res.status).toBe(200);
    expect(res.body.member.status).toBe("INACTIVE");
  });
});
