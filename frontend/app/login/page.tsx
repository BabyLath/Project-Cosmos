import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/components/auth/LoginForm";
import { getServerSession } from "@/lib/session";

export default async function LoginPage() {
  const user = await getServerSession();
  if (user) redirect("/dashboard");

  return (
    <AuthLayout title="Welcome back" description="Sign in to manage your organization.">
      {/* useSearchParams (for the post-login redirectTo param) requires
          a Suspense boundary in a server-rendered route. */}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}
