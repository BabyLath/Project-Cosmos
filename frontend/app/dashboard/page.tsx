import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { AppNav } from "@/components/AppNav";
import { canManageMembers } from "@/lib/permissions";

export default async function DashboardPage() {
  // This is the actual security boundary: proxy.ts only checked that a
  // cookie exists, this call validates it against the database via the
  // backend's /api/auth/me. An expired or forged cookie value lands
  // here, not on the proxy.
  const user = await getServerSession();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-oms-bg text-oms-text">
      <AppNav user={user} />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Welcome, {user.fullName}</h1>
        <p className="mb-6 text-sm text-oms-text-muted">
          {user.email} · {user.role}
        </p>

        <div className="rounded-xl border border-oms-surface-alt bg-oms-surface p-6">
          {canManageMembers(user.role) ? (
            <p className="text-oms-text-muted">
              Manage accounts in{" "}
              <Link href="/members" className="text-oms-accent hover:text-oms-accent-hover">
                Members
              </Link>
              . Finance, documents, announcements, attendance, and events modules will plug in here.
            </p>
          ) : (
            <p className="text-oms-text-muted">
              You are signed in. More OMS modules will appear here as they are added.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
