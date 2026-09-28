import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { canManageMembers } from "@/lib/permissions";
import { AppNav } from "@/components/AppNav";
import { MembersTable } from "@/components/members/MembersTable";

export default async function MembersPage() {
  const user = await getServerSession();
  if (!user) redirect("/login");
  if (!canManageMembers(user.role)) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-oms-bg text-oms-text">
      <AppNav user={user} />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold">Members</h1>
        <MembersTable currentUser={{ id: user.id, role: user.role }} />
      </main>
    </div>
  );
}
