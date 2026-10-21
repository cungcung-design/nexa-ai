import type { Metadata } from "next";

import { AuthForm } from "@/components/public/auth-form";
import { LoginIcon } from "@/components/public/auth-icons";
import { AuthShell } from "@/components/public/auth-shell";
import { safeNextPath } from "@/lib/navigation";
import "../auth.css";

export const metadata: Metadata = {
  title: "Log In — NEXORA",
  description: "Sign in to your NEXORA workspace.",
};

// The page reads the sign in redirect from the query string, so it renders
// at request time instead of being prerendered.
export const instant = false;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const next = safeNextPath(query.next);

  return (
    <AuthShell
      variant="login"
      brandIcon={<LoginIcon className="nx-auth-icon" />}
      title="Welcome back"
      description="Sign in to your NEXORA workspace."
    >
      <AuthForm mode="login" next={next} />
    </AuthShell>
  );
}
