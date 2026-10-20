import type { ReactNode } from "react";
import Link from "next/link";

import { AccountIcon } from "@/components/public/auth-icons";
import { AuthShell } from "@/components/public/auth-shell";

/**
 * A simple legal page used by the sign up form.
 */
export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <AuthShell
      variant="register"
      brandIcon={<AccountIcon className="nx-auth-icon" />}
      title={title}
      description=""
    >
      <div className="nx-auth-subtitle">{children}</div>
      <p className="nx-auth-switch">
        <Link href="/register">Back to sign up</Link>
      </p>
    </AuthShell>
  );
}
