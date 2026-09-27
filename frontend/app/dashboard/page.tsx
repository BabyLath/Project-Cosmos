import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default async function DashboardPage() {
  // This is the actual security boundary: middleware.ts only checked
  // that a cookie exists, this call validates it against the database
  // via the backend's /api/auth/me. An expired or forged cookie value
  // lands here, not on the middleware.
  const user = await getServerSession();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-oms-bg px-4 py-12 text-oms-text">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Welcome, {user.fullName}</h1>
            <p className="text-sm text-oms-text-muted">
              {user.email} · {user.role}
            </p>
          </div>
          <LogoutButton />
        </div>

        <div className="rounded-xl border border-oms-surface-alt bg-oms-surface p-6">
          <p className="text-oms-text-muted">
            This is a placeholder dashboard confirming authentication works end to end. Member
            management, finance, documents, announcements, attendance, and events modules will
            plug in here.
          </p>
        </div>
      </div>
    </div>
  );
}
