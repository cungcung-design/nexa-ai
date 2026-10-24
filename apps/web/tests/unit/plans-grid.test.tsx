import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { PlansGrid } from "@/components/billing/plans-grid";
import type { BillingCatalogPlan } from "@/lib/api";

const plans: BillingCatalogPlan[] = [
  {
    key: "FREE",
    label: "Free",
    tagline: "Explore",
    features: ["Limited AI requests"],
    limits: {
      agents: 2,
      monthly_requests: 100,
      knowledge_bases: 1,
      workflow_executions: 100,
      storage_mb: 100,
      seats: 5,
    },
    monthly: {
      amount: 0,
      currency: "usd",
      interval: "monthly",
      monthly_equivalent: 0,
      annual_total: 0,
    },
    yearly: null,
    contact_sales: false,
    popular: false,
    purchasable: false,
    current: true,
  },
  {
    key: "STARTER",
    label: "Starter",
    tagline: "For small teams",
    features: ["Higher usage limits"],
    limits: {
      agents: 5,
      monthly_requests: 1000,
      knowledge_bases: 5,
      workflow_executions: 1000,
      storage_mb: 500,
      seats: 10,
    },
    monthly: {
      amount: 1900,
      currency: "usd",
      interval: "monthly",
      monthly_equivalent: 1900,
      annual_total: 22800,
    },
    yearly: {
      amount: 19000,
      currency: "usd",
      interval: "yearly",
      monthly_equivalent: 1583,
      annual_total: 19000,
    },
    contact_sales: false,
    popular: false,
    purchasable: false,
    current: false,
  },
  {
    key: "PRO",
    label: "Pro",
    tagline: "For growing teams",
    features: ["Usage analytics"],
    limits: {
      agents: 10,
      monthly_requests: 5000,
      knowledge_bases: 20,
      workflow_executions: 5000,
      storage_mb: 2000,
      seats: 25,
    },
    monthly: {
      amount: 4900,
      currency: "usd",
      interval: "monthly",
      monthly_equivalent: 4900,
      annual_total: 58800,
    },
    yearly: {
      amount: 49000,
      currency: "usd",
      interval: "yearly",
      monthly_equivalent: 4083,
      annual_total: 49000,
    },
    contact_sales: false,
    popular: true,
    purchasable: false,
    current: false,
  },
  {
    key: "BUSINESS",
    label: "Enterprise",
    tagline: "For organizations",
    features: ["Custom quotas"],
    limits: {
      agents: 50,
      monthly_requests: 25000,
      knowledge_bases: 100,
      workflow_executions: 25000,
      storage_mb: 20000,
      seats: 100,
    },
    monthly: null,
    yearly: null,
    contact_sales: true,
    popular: false,
    purchasable: false,
    current: false,
  },
];

describe("PlansGrid", () => {
  it("shows catalog prices and an unavailable checkout when Stripe is disconnected", () => {
    render(
      <PlansGrid
        organizationId="org-1"
        plans={plans}
        canManage
        currentPlan="FREE"
        providerConfigured={false}
      />
    );

    expect(screen.getByText("$0")).toBeInTheDocument();
    expect(screen.getByText("$19")).toBeInTheDocument();
    expect(screen.getByText("$49")).toBeInTheDocument();
    expect(screen.getByText("Custom")).toBeInTheDocument();
    expect(
      screen.getByText(/payment provider is not connected/i)
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Checkout unavailable" })).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Contact Sales" })).toHaveAttribute(
      "href",
      "/contact"
    );
    expect(screen.queryByText("$29")).not.toBeInTheDocument();
    expect(screen.queryByText("$99")).not.toBeInTheDocument();
  });
});
