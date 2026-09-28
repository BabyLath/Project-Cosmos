import { z } from "zod";

const roleEnum = z.enum(["ADMIN", "OFFICER", "MEMBER"]);
const statusEnum = z.enum(["ACTIVE", "INACTIVE"]);

export const listMembersQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  role: roleEnum.optional(),
  status: statusEnum.optional(),
  page: z.coerce.number().int().positive().default(1),
  // Capped well below anything that could be used to pull the whole
  // table in one request.
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const createMemberSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required").max(200),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  role: roleEnum.default("MEMBER"),
});

export const updateMemberSchema = z
  .object({
    fullName: z.string().trim().min(1, "Full name is required").max(200).optional(),
    email: z.string().trim().toLowerCase().email("Enter a valid email address").optional(),
    role: roleEnum.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields provided to update" });

export const updateMemberStatusSchema = z.object({
  status: statusEnum,
});

export type ListMembersQuery = z.infer<typeof listMembersQuerySchema>;
export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type UpdateMemberStatusInput = z.infer<typeof updateMemberStatusSchema>;
