import Link from "next/link";
import type { SessionUser } from "@/lib/api/auth";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { canManageMembers } from "@/lib/permissions";

export function AppNav({ user }: { user: SessionUser }) {
  return (
    <header className="border-b border-oms-surface-alt bg-oms-surface">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <nav aria-label="Main" className="flex items-center gap-6 text-sm font-medium">
          <span className="rounded bg-oms-accent px-2 py-1 text-xs font-bold text-oms-bg">OMS</span>
          <Link href="/dashboard" className="text-oms-text hover:text-oms-accent">
            Dashboard
          </Link>
          {canManageMembers(user.role) && (
            <Link href="/members" className="text-oms-text hover:text-oms-accent">
              Members
            </Link>
          )}
        </nav>
        <LogoutButton />
      </div>
    </header>
  );
}
