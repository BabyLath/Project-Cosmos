"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { resetPassword, ApiError } from "@/lib/api/auth";
import { PasswordInput } from "./PasswordInput";
import { FormError } from "./FormError";

function validatePassword(value: string): string | undefined {
  if (!value) return "Password is required";
  if (value.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) return "Password must include a letter and a number";
  return undefined;
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const nextErrors: typeof fieldErrors = {};
    const passwordError = validatePassword(password);
    if (passwordError) nextErrors.password = passwordError;
    if (password !== confirmPassword) nextErrors.confirmPassword = "Passwords do not match";

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await resetPassword(token, password, confirmPassword);
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn't reach the server. Try again.");
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <p className="text-center text-oms-text">
        Your password has been updated. Redirecting you to sign in…
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormError message={formError} />
      <div className="space-y-4">
        <PasswordInput
          label="New password"
          id="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
        />
        <PasswordInput
          label="Confirm new password"
          id="confirmPassword"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={fieldErrors.confirmPassword}
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-oms-accent px-4 py-2.5 font-medium text-oms-bg transition hover:bg-oms-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Updating…" : "Update password"}
        </button>
      </div>
    </form>
  );
}
