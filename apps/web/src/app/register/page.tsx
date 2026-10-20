import type { Metadata } from "next";

import { AuthForm } from "@/components/public/auth-form";
import { AccountIcon } from "@/components/public/auth-icons";
import { AuthShell } from "@/components/public/auth-shell";
import { safeNextPath } from "@/lib/navigation";
import "../auth.css";

export const metadata: Metadata = {
  title: "Sign Up — Nexa AI",
  description: "Start building with Nexa AI.",
};

// The page reads the sign in redirect from the query string, so it renders
// at request time instead of being prerendered.
export const instant = false;

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const next = safeNextPath(query.next);

  return (
    <AuthShell
      variant="register"
      brandIcon={<AccountIcon className="nx-auth-icon" />}
      title="Create your account"
      description="Start building with Nexa AI."
    >
      <AuthForm mode="register" next={next} />
    </AuthShell>
  );
}
