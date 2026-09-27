import { AuthLayout } from "@/components/auth/AuthLayout";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <AuthLayout title="Reset your password" description="Enter your email and we'll send you a reset link.">
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
