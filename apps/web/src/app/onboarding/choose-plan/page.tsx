import type { Metadata } from "next";

import { ChoosePlanView } from "./choose-plan-view";

export const metadata: Metadata = {
  title: "Choose your plan — NEXORA",
  description: "Pick the plan of your NEXORA workspace.",
};

// The page reads the result of the checkout from the query string, so it
// renders at request time instead of being prerendered.
export const instant = false;

export default async function ChoosePlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const checkout = Array.isArray(query.checkout)
    ? query.checkout[0]
    : query.checkout;

  return <ChoosePlanView checkout={checkout ?? null} />;
}
