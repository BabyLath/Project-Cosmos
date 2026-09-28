import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { canManageMembers } from "@/lib/permissions";
import { AppNav } from "@/components/AppNav";
import { MemberDetail } from "@/components/members/MemberDetail";

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getServerSession();
  if (!user) redirect("/login");
  if (!canManageMembers(user.role)) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-oms-bg text-oms-text">
      <AppNav user={user} />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <MemberDetail id={id} currentUser={{ id: user.id, role: user.role }} />
      </main>
    </div>
  );
}
