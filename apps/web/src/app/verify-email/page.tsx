import type { Metadata } from "next";

import { VerifyEmailView } from "./verify-email-view";

export const metadata: Metadata = {
  title: "Confirm your email — Nexa AI",
  description: "Confirm your email address to open your Nexa AI workspace.",
};

// The page reads the token of the verification link from the query string, so
// it renders at request time instead of being prerendered.
export const instant = false;

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const token = Array.isArray(query.token) ? query.token[0] : query.token;

  return <VerifyEmailView token={token ?? null} />;
}
