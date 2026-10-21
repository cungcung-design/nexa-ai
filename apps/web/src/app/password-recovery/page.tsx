import type { Metadata } from "next";

import { PasswordRecoveryFlow } from "@/components/public/password-recovery-flow";

export const metadata: Metadata = {
  title: "Reset your password — Nexa AI",
  description: "Request a password reset link for your Nexa AI account.",
};

// The page reads the reset token from the query string, so it renders at
// request time instead of being prerendered.
export const instant = false;

export default async function PasswordRecoveryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const raw = query.token;
  const token = typeof raw === "string" ? raw.trim() : "";

  return <PasswordRecoveryFlow initialToken={token} />;
}
