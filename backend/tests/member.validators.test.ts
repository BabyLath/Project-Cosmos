import { describe, it, expect } from "vitest";
import {
  listMembersQuerySchema,
  createMemberSchema,
  updateMemberSchema,
  updateMemberStatusSchema,
} from "../src/validators/member.validators";

describe("listMembersQuerySchema", () => {
  it("defaults page/pageSize", () => {
    const result = listMembersQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it("caps pageSize at 100", () => {
    expect(() => listMembersQuerySchema.parse({ pageSize: 500 })).toThrow();
  });

  it("rejects an unknown role", () => {
    expect(() => listMembersQuerySchema.parse({ role: "SUPERUSER" })).toThrow();
  });
});

describe("createMemberSchema", () => {
  it("defaults role to MEMBER", () => {
    const result = createMemberSchema.parse({ fullName: "Jane Doe", email: "jane@example.org" });
    expect(result.role).toBe("MEMBER");
  });

  it("rejects an invalid email", () => {
    expect(() => createMemberSchema.parse({ fullName: "Jane Doe", email: "not-an-email" })).toThrow();
  });

  it("rejects an empty full name", () => {
    expect(() => createMemberSchema.parse({ fullName: "  ", email: "jane@example.org" })).toThrow();
  });
});

describe("updateMemberSchema", () => {
  it("rejects an empty update", () => {
    expect(() => updateMemberSchema.parse({})).toThrow();
  });

  it("accepts a partial update", () => {
    expect(() => updateMemberSchema.parse({ fullName: "New Name" })).not.toThrow();
  });
});

describe("updateMemberStatusSchema", () => {
  it("rejects a status outside the enum", () => {
    expect(() => updateMemberStatusSchema.parse({ status: "BANNED" })).toThrow();
  });

  it("accepts ACTIVE and INACTIVE", () => {
    expect(() => updateMemberStatusSchema.parse({ status: "ACTIVE" })).not.toThrow();
    expect(() => updateMemberStatusSchema.parse({ status: "INACTIVE" })).not.toThrow();
  });
});
