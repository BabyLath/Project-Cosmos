import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { hashPassword, createPasswordResetToken } from "./auth.service";
import { sendMemberInviteEmail } from "./email.service";
import type { CreateMemberInput, ListMembersQuery, UpdateMemberInput } from "../validators/member.validators";

export class DuplicateEmailError extends Error {}
export class MemberNotFoundError extends Error {}

// Fields safe to return to the client. Never includes passwordHash.
const memberSelect = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type MemberDto = Prisma.UserGetPayload<{ select: typeof memberSelect }>;

export async function listMembers(query: ListMembersQuery) {
  const where: Prisma.UserWhereInput = {
    ...(query.role ? { role: query.role } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { fullName: { contains: query.search, mode: "insensitive" } },
            { email: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, members] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: memberSelect,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return {
    members,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

export async function getMemberById(id: string): Promise<MemberDto> {
  const member = await prisma.user.findUnique({ where: { id }, select: memberSelect });
  if (!member) throw new MemberNotFoundError();
  return member;
}

/**
 * Creates a member with no password the creator ever sees or chooses:
 * a random, never-revealed temporary password is set, then the same
 * password-reset mechanism used by "forgot password" issues a "set
 * your password" link. This reuses existing auth infrastructure
 * rather than building a separate invitation system.
 */
export async function createMember(data: CreateMemberInput): Promise<MemberDto> {
  const temporaryPassword = crypto.randomBytes(32).toString("hex");
  const passwordHash = await hashPassword(temporaryPassword);

  let created;
  try {
    created = await prisma.user.create({
      data: {
        fullName: data.fullName,
        email: data.email,
        passwordHash,
        role: data.role,
        status: "ACTIVE",
      },
      select: memberSelect,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new DuplicateEmailError();
    }
    throw err;
  }

  // Always succeeds here since we just created the user by this email.
  const tokenResult = await createPasswordResetToken(data.email);
  if (tokenResult) {
    const resetUrl = `${env.CORS_ORIGIN}/reset-password/${tokenResult.rawToken}`;
    await sendMemberInviteEmail(data.email, resetUrl);
  }

  return created;
}

export async function updateMember(id: string, data: UpdateMemberInput): Promise<MemberDto> {
  try {
    return await prisma.user.update({
      where: { id },
      data: {
        ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.role !== undefined ? { role: data.role } : {}),
      },
      select: memberSelect,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") throw new DuplicateEmailError();
      if (err.code === "P2025") throw new MemberNotFoundError();
    }
    throw err;
  }
}

/**
 * Updates account status. On deactivation, every existing session for
 * that user is deleted in the same transaction, so a deactivated
 * member is logged out everywhere immediately rather than merely
 * blocked from future logins.
 */
export async function updateMemberStatus(id: string, status: "ACTIVE" | "INACTIVE"): Promise<MemberDto> {
  try {
    const [updated] = await prisma.$transaction([
      prisma.user.update({ where: { id }, data: { status }, select: memberSelect }),
      ...(status === "INACTIVE" ? [prisma.session.deleteMany({ where: { userId: id } })] : []),
    ]);
    return updated as MemberDto;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      throw new MemberNotFoundError();
    }
    throw err;
  }
}
