import { describe, it, expect } from "vitest";
import { loginSchema, resetPasswordSchema, forgotPasswordSchema } from "../src/validators/auth.validators";

describe("loginSchema", () => {
  it("accepts valid input and lowercases/trims the email", () => {
    const result = loginSchema.parse({ email: " User@Example.ORG ", password: "x" });
    expect(result.email).toBe("user@example.org");
    expect(result.rememberMe).toBe(false); // default
  });

  it("rejects an invalid email", () => {
    expect(() => loginSchema.parse({ email: "not-an-email", password: "x" })).toThrow();
  });

  it("rejects an empty password", () => {
    expect(() => loginSchema.parse({ email: "user@example.org", password: "" })).toThrow();
  });
});

describe("forgotPasswordSchema", () => {
  it("rejects a missing email", () => {
    expect(() => forgotPasswordSchema.parse({})).toThrow();
  });
});

describe("resetPasswordSchema", () => {
  const base = { token: "abc123" };

  it("accepts a valid password that meets the policy", () => {
    expect(() =>
      resetPasswordSchema.parse({ ...base, password: "goodPass1", confirmPassword: "goodPass1" })
    ).not.toThrow();
  });

  it("rejects passwords shorter than 8 characters", () => {
    expect(() => resetPasswordSchema.parse({ ...base, password: "short1", confirmPassword: "short1" })).toThrow();
  });

  it("rejects a password with no digit", () => {
    expect(() =>
      resetPasswordSchema.parse({ ...base, password: "onlyletters", confirmPassword: "onlyletters" })
    ).toThrow();
  });

  it("rejects mismatched password and confirmPassword", () => {
    expect(() =>
      resetPasswordSchema.parse({ ...base, password: "goodPass1", confirmPassword: "different1" })
    ).toThrow();
  });
});
