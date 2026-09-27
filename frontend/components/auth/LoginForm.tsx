"use client";

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { login, ApiError } from "@/lib/api/auth";
import { PasswordInput } from "./PasswordInput";
import { FormError } from "./FormError";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const nextFieldErrors: typeof fieldErrors = {};
    if (!email) nextFieldErrors.email = "Email is required";
    else if (!isValidEmail(email)) nextFieldErrors.email = "Enter a valid email address";
    if (!password) nextFieldErrors.password = "Password is required";

    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) return;

    setSubmitting(true); // also prevents duplicate submissions via the disabled button below
    try {
      await login(email, password, rememberMe);
      const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError("Couldn't reach the server. Check your connection and try again.");
      }
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormError message={formError} />

      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-oms-text">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
            className={`w-full rounded-lg border bg-oms-surface-alt px-3 py-2.5 text-oms-text placeholder:text-oms-text-muted focus:outline-none focus:ring-2 focus:ring-oms-accent ${
              fieldErrors.email ? "border-oms-danger" : "border-oms-surface-alt"
            }`}
            placeholder="you@organization.org"
          />
          {fieldErrors.email && (
            <p id="email-error" className="mt-1.5 text-sm text-oms-danger">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <PasswordInput
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
        />

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-oms-text-muted">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-oms-surface-alt bg-oms-surface-alt accent-oms-accent"
            />
            Remember me
          </label>
          <Link href="/forgot-password" className="font-medium text-oms-accent hover:text-oms-accent-hover">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-oms-accent px-4 py-2.5 font-medium text-oms-bg transition hover:bg-oms-accent-hover focus:outline-none focus:ring-2 focus:ring-oms-accent focus:ring-offset-2 focus:ring-offset-oms-surface disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </div>
    </form>
  );
}
