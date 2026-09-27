import { AuthLayout } from "@/components/auth/AuthLayout";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <AuthLayout title="Set a new password" description="Choose a new password for your account.">
      <ResetPasswordForm token={token} />
    </AuthLayout>
  );
}
