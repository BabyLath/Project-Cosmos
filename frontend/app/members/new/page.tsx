import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { canManageMembers } from "@/lib/permissions";
import { AppNav } from "@/components/AppNav";
import { MemberForm } from "@/components/members/MemberForm";

export default async function NewMemberPage() {
  const user = await getServerSession();
  if (!user) redirect("/login");
  if (!canManageMembers(user.role)) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-oms-bg text-oms-text">
      <AppNav user={user} />
      <main className="mx-auto max-w-xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold">Add member</h1>
        <div className="rounded-xl border border-oms-surface-alt bg-oms-surface p-6">
          <MemberForm mode="create" actor={{ id: user.id, role: user.role }} />
        </div>
      </main>
    </div>
  );
}
