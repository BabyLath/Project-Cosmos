import { describe, it, expect, vi, beforeEach } from "vitest";

// Stand-in for the generated Prisma client so these tests run without
// `prisma generate` (which needs to download engine binaries).
vi.mock("@prisma/client", () => {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    constructor(message: string, opts: { code: string; clientVersion: string }) {
      super(message);
      this.code = opts.code;
    }
  }
  return { Prisma: { PrismaClientKnownRequestError }, PrismaClient: class {} };
});
import { Prisma } from "@prisma/client";

vi.mock("../src/config/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    session: { deleteMany: vi.fn() },
    passwordResetToken: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../src/services/email.service", () => ({
  sendPasswordResetEmail: vi.fn(),
  sendMemberInviteEmail: vi.fn(),
}));

import { prisma } from "../src/config/prisma";
import { sendMemberInviteEmail } from "../src/services/email.service";
import {
  listMembers,
  getMemberById,
  createMember,
  updateMember,
  updateMemberStatus,
  DuplicateEmailError,
  MemberNotFoundError,
} from "../src/services/member.service";
import { listMembersQuerySchema } from "../src/validators/member.validators";

const mockedPrisma = vi.mocked(prisma, true);

function p2002() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

function p2025() {
  return new Prisma.PrismaClientKnownRequestError("Record not found", {
    code: "P2025",
    clientVersion: "test",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listMembers", () => {
  it("applies search, role and status filters together", async () => {
    mockedPrisma.user.count.mockResolvedValue(1);
    mockedPrisma.user.findMany.mockResolvedValue([] as never);

    const query = listMembersQuerySchema.parse({ search: "jane", role: "OFFICER", status: "ACTIVE" });
    await listMembers(query);

    const whereArg = mockedPrisma.user.count.mock.calls[0][0]?.where;
    expect(whereArg).toMatchObject({ role: "OFFICER", status: "ACTIVE" });
    expect(whereArg?.OR).toEqual([
      { fullName: { contains: "jane", mode: "insensitive" } },
      { email: { contains: "jane", mode: "insensitive" } },
    ]);
  });

  it("paginates using page/pageSize", async () => {
    mockedPrisma.user.count.mockResolvedValue(45);
    mockedPrisma.user.findMany.mockResolvedValue([] as never);

    const query = listMembersQuerySchema.parse({ page: 2, pageSize: 20 });
    const result = await listMembers(query);

    expect(mockedPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 20 })
    );
    expect(result.pagination).toEqual({ page: 2, pageSize: 20, total: 45, totalPages: 3 });
  });
});

describe("getMemberById", () => {
  it("throws MemberNotFoundError when the member does not exist", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    await expect(getMemberById("missing")).rejects.toThrow(MemberNotFoundError);
  });
});

describe("createMember", () => {
  it("creates the member and sends an invite email with a set-password link", async () => {
    mockedPrisma.user.create.mockResolvedValue({
      id: "u1",
      fullName: "Jane Doe",
      email: "jane@example.org",
      role: "MEMBER",
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    mockedPrisma.user.findUnique.mockResolvedValue({ id: "u1", email: "jane@example.org" } as never);
    mockedPrisma.passwordResetToken.create.mockResolvedValue({} as never);

    const member = await createMember({ fullName: "Jane Doe", email: "jane@example.org", role: "MEMBER" });

    expect(member.email).toBe("jane@example.org");
    expect((member as never as { passwordHash?: string }).passwordHash).toBeUndefined();
    expect(sendMemberInviteEmail).toHaveBeenCalledWith("jane@example.org", expect.stringContaining("/reset-password/"));
  });

  it("throws DuplicateEmailError when the email is already taken", async () => {
    mockedPrisma.user.create.mockRejectedValue(p2002());
    await expect(
      createMember({ fullName: "Jane Doe", email: "taken@example.org", role: "MEMBER" })
    ).rejects.toThrow(DuplicateEmailError);
  });
});

describe("updateMember", () => {
  it("throws DuplicateEmailError on a unique constraint violation", async () => {
    mockedPrisma.user.update.mockRejectedValue(p2002());
    await expect(updateMember("u1", { email: "taken@example.org" })).rejects.toThrow(DuplicateEmailError);
  });

  it("throws MemberNotFoundError when the target does not exist", async () => {
    mockedPrisma.user.update.mockRejectedValue(p2025());
    await expect(updateMember("missing", { fullName: "New Name" })).rejects.toThrow(MemberNotFoundError);
  });
});

describe("updateMemberStatus", () => {
  it("deactivating a member also deletes their sessions, in one transaction", async () => {
    const updatedUser = {
      id: "u1",
      fullName: "Jane Doe",
      email: "jane@example.org",
      role: "MEMBER",
      status: "INACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockedPrisma.$transaction.mockImplementation(async (ops: unknown) => {
      // First op result mirrors the user.update return value.
      return [updatedUser, { count: 2 }];
    });

    const result = await updateMemberStatus("u1", "INACTIVE");

    expect(result.status).toBe("INACTIVE");
    expect(mockedPrisma.$transaction).toHaveBeenCalled();
    const opsArg = mockedPrisma.$transaction.mock.calls[0][0] as unknown[];
    expect(opsArg).toHaveLength(2); // user.update + session.deleteMany
  });

  it("reactivating a member does not touch sessions", async () => {
    const updatedUser = {
      id: "u1",
      fullName: "Jane Doe",
      email: "jane@example.org",
      role: "MEMBER",
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockedPrisma.$transaction.mockImplementation(async () => [updatedUser]);

    await updateMemberStatus("u1", "ACTIVE");

    const opsArg = mockedPrisma.$transaction.mock.calls[0][0] as unknown[];
    expect(opsArg).toHaveLength(1); // user.update only
  });
});
