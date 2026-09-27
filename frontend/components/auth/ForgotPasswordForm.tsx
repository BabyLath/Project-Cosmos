"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { forgotPassword, ApiError } from "@/lib/api/auth";
import { FormError } from "./FormError";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!email) {
      setFieldError("Email is required");
      return;
    }
    if (!isValidEmail(email)) {
      setFieldError("Enter a valid email address");
      return;
    }
    setFieldError(undefined);

    setSubmitting(true);
    try {
      await forgotPassword(email);
      // Show the same success state regardless of whether the email
      // existed — the backend already returns an identical response,
      // and the UI shouldn't leak that distinction either.
      setSubmitted(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn't reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center">
        <p className="text-oms-text">
          If an account with that email exists, we&apos;ve sent a password reset link to <strong>{email}</strong>.
        </p>
        <Link href="/login" className="mt-4 inline-block text-sm font-medium text-oms-accent hover:text-oms-accent-hover">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormError message={formError} />
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
          aria-invalid={Boolean(fieldError)}
          className={`w-full rounded-lg border bg-oms-surface-alt px-3 py-2.5 text-oms-text placeholder:text-oms-text-muted focus:outline-none focus:ring-2 focus:ring-oms-accent ${
            fieldError ? "border-oms-danger" : "border-oms-surface-alt"
          }`}
          placeholder="you@organization.org"
        />
        {fieldError && <p className="mt-1.5 text-sm text-oms-danger">{fieldError}</p>}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="mt-4 w-full rounded-lg bg-oms-accent px-4 py-2.5 font-medium text-oms-bg transition hover:bg-oms-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Sending…" : "Send reset link"}
      </button>

      <p className="mt-4 text-center text-sm text-oms-text-muted">
        <Link href="/login" className="font-medium text-oms-accent hover:text-oms-accent-hover">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
