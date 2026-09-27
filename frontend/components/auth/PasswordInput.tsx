"use client";

import { useState, forwardRef } from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput(
  { label, error, id, ...rest },
  ref
) {
  const [visible, setVisible] = useState(false);
  const inputId = id ?? "password";

  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-oms-text">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={visible ? "text" : "password"}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={`w-full rounded-lg border bg-oms-surface-alt px-3 py-2.5 pr-11 text-oms-text placeholder:text-oms-text-muted focus:outline-none focus:ring-2 focus:ring-oms-accent ${
            error ? "border-oms-danger" : "border-oms-surface-alt"
          }`}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-oms-text-muted hover:text-oms-text"
          aria-label={visible ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {error && (
        <p id={`${inputId}-error`} className="mt-1.5 text-sm text-oms-danger">
          {error}
        </p>
      )}
    </div>
  );
});

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 5.06-6.06M9.9 4.24A10.6 10.6 0 0 1 12 4c7 0 11 8 11 8a20.4 20.4 0 0 1-4.22 5.61M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  );
}
