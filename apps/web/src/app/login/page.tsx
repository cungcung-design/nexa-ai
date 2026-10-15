import { AuthLayout } from "@/components/auth-layout";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Sign in to your workspace"
      description="Use your Nexa AI account to continue to your organization."
    >
      <LoginForm mode="login" />
      <p className="mt-6 text-xs leading-5 text-slate-500">
        Your session is maintained by Nexa AI authentication.
      </p>
    </AuthLayout>
  );
}
