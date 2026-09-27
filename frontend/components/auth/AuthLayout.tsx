import { ReactNode } from "react";

export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-oms-bg px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-oms-accent text-lg font-bold text-oms-bg"
            aria-hidden="true"
          >
            OMS
          </div>
          <h1 className="text-2xl font-semibold text-oms-text">{title}</h1>
          {description && <p className="mt-2 text-sm text-oms-text-muted">{description}</p>}
        </div>

        <div className="rounded-xl border border-oms-surface-alt bg-oms-surface p-6 shadow-lg sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
