import Link from "next/link";
import { AuthLayout } from "@/components/auth-layout";

export default function PasswordRecoveryPage() {
  return (
    <AuthLayout
      eyebrow="Account access"
      title="Password recovery"
      description="Password reset is not available for this workspace yet."
    >
      <div
        role="status"
        className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"
      >
        The connected authentication service does not currently provide a
        password reset endpoint. Contact your workspace administrator for help.
      </div>
      <Link
        href="/login"
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-indigo-700"
      >
        Return to sign in
      </Link>
    </AuthLayout>
  );
}
