import { AuthLayout } from "@/components/auth-layout";
import { LoginForm } from "@/components/login-form";

export default function RegisterPage() {
  return (
    <AuthLayout
      eyebrow="Get started"
      title="Create your account"
      description="Set up your account and create a workspace for your AI team."
    >
      <LoginForm mode="register" />
      <p className="mt-6 text-xs leading-5 text-slate-500">
        Your account is created through the Nexa AI backend and signed in
        immediately.
      </p>
    </AuthLayout>
  );
}
