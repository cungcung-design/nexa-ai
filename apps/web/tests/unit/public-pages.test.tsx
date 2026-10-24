import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { ContactPage } from "@/components/public/contact-page";
import { FeaturesPage } from "@/components/public/features-page";
import {
  PricingCatalog,
  type PublicPlan,
} from "@/components/public/pricing-catalog";
import { SecurityPage } from "@/components/public/security-page";
import { SolutionsPage } from "@/components/public/solutions-page";

const PLANS: PublicPlan[] = [
  {
    key: "FREE",
    label: "Free",
    tagline: "Explore essential AI automation",
    features: [
      "Limited AI requests",
      "Basic agents and workflows",
      "Community-level support",
    ],
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
  },
  {
    key: "STARTER",
    label: "Starter",
    tagline: "For small teams getting started",
    features: ["Higher usage limits", "More active agents", "Team collaboration"],
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
  },
  {
    key: "PRO",
    label: "Pro",
    tagline: "For growing automation teams",
    features: ["Advanced agent tools", "Expanded workflow limits", "Usage analytics"],
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
  },
  {
    key: "BUSINESS",
    label: "Enterprise",
    tagline: "For organizations with custom requirements",
    features: ["Custom quotas", "Advanced access controls", "Dedicated agreements"],
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
  },
];

describe("public marketing pages", () => {
  it("renders the features page sections", () => {
    render(<FeaturesPage />);
    for (const title of [
      "What a NEXORA workspace includes",
      "AI Agents",
      "Workflows",
      "Knowledge Base",
      "Integrations",
      "Human Approvals",
      "Analytics and Monitoring",
      "Security and Control",
    ]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "Read the security page" })).toHaveAttribute(
      "href",
      "/security"
    );
  });

  it("renders the solutions page without testimonials", () => {
    render(<SolutionsPage />);
    for (const title of [
      "Customer Support",
      "Operations Automation",
      "Knowledge Assistance",
      "AI Workflow Automation",
      "Use-case explanations",
    ]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    expect(screen.queryByText(/testimonial/i)).not.toBeInTheDocument();
  });

  it("renders the security page without certification claims", () => {
    render(<SecurityPage />);
    for (const title of [
      "Controls that are part of NEXORA",
      "Security Capabilities",
      "Security Principles",
      "Human-in-the-Loop",
      "Audit Logs and Monitoring",
      "Data and Privacy",
      "Security FAQ",
    ]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    expect(screen.queryByText(/SOC 2|ISO 27001|encryption at rest/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
  });

  it("renders the contact form without a success message", () => {
    render(<ContactPage />);
    expect(screen.getByRole("heading", { name: "Contact NEXORA" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Full Name/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send Message" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Common inquiry categories" })).toBeInTheDocument();
    expect(screen.queryByText(/Thanks for reaching out/)).not.toBeInTheDocument();
  });

  it("renders catalog prices and limits", () => {
    render(<PricingCatalog plans={PLANS} unavailable={false} />);
    expect(screen.getByText("$0")).toBeInTheDocument();
    expect(screen.getByText("$19")).toBeInTheDocument();
    expect(screen.getByText("$49")).toBeInTheDocument();
    expect(screen.getByText("Custom")).toBeInTheDocument();
    expect(screen.getByText("2 agents")).toBeInTheDocument();
    expect(screen.getByText("100 monthly AI requests")).toBeInTheDocument();
    expect(screen.getByText("5 seats")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact sales" })).toHaveAttribute(
      "href",
      "/contact"
    );
    expect(
      screen.getAllByText("Online checkout is not configured for this plan.")
    ).toHaveLength(2);
  });

  it("does not invent prices when the catalog is unavailable", () => {
    render(<PricingCatalog plans={null} unavailable />);
    expect(
      screen.getByRole("heading", { name: "The pricing catalog could not be loaded" })
    ).toBeInTheDocument();
    expect(screen.queryByText("$19")).not.toBeInTheDocument();
  });
});
