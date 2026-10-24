import type { Metadata } from "next";

import {
  PricingCatalog,
  type PublicPlan,
} from "@/components/public/pricing-catalog";
import { API_URL } from "@/lib/api";

export const metadata: Metadata = {
  title: "Pricing — NEXORA",
};

export const instant = false;

export default async function Page() {
  let plans: PublicPlan[] | null = null;
  let unavailable = false;
  try {
    const response = await fetch(`${API_URL}/api/v1/public/plans`, {
      cache: "no-store",
    });
    if (!response.ok) {
      unavailable = true;
    } else {
      const body = (await response.json()) as { plans?: PublicPlan[] };
      plans = Array.isArray(body.plans) ? body.plans : null;
      unavailable = plans == null;
    }
  } catch {
    unavailable = true;
  }

  return <PricingCatalog plans={plans} unavailable={unavailable} />;
}
