import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { PublicHomePage } from "@/components/public-home-page";
import { CallToAction } from "@/components/public/call-to-action";
import { ContactSection } from "@/components/public/contact-section";
import { FaqSection } from "@/components/public/faq-section";
import { PricingSection } from "@/components/public/pricing-section";
import { SecuritySection } from "@/components/public/security-section";
import { SolutionsSection } from "@/components/public/solutions-section";

const NAV_ITEMS = ["Product", "Features", "Solutions", "Pricing", "Security", "Contact"];

const PLANS = [
  { name: "Free", price: "$0" },
  { name: "Starter", price: "$19" },
  { name: "Pro", price: "$49" },
  { name: "Enterprise", price: "Custom" },
];

describe("homepage navigation", () => {
  it("points each item at a section with the same heading", () => {
    render(<PublicHomePage />);

    const nav = screen.getByRole("navigation", { name: "Main navigation" });

    for (const label of NAV_ITEMS) {
      expect(within(nav).getByRole("link", { name: label })).toHaveAttribute(
        "href",
        `#${label.toLowerCase()}`
      );
      expect(screen.getByRole("heading", { name: label })).toBeInTheDocument();
    }
  });
});

describe("PricingSection", () => {
  it("lists every plan of the design", () => {
    render(<PricingSection />);

    const names = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);

    expect(names).toEqual(["Pricing", ...PLANS.map((plan) => plan.name)]);
  });

  it("shows the price of every plan", () => {
    const { container } = render(<PricingSection />);

    const prices = Array.from(container.querySelectorAll(".nx-price")).map(
      (price) => price.textContent
    );

    expect(prices).toEqual(PLANS.map((plan) => plan.price));
  });

  it("lists the features of every plan with a check mark", () => {
    const { container } = render(<PricingSection />);

    const plans = container.querySelectorAll(".nx-plan");
    const features = container.querySelectorAll(".nx-plan-feature");
    const checks = container.querySelectorAll(".nx-check");

    expect(plans).toHaveLength(PLANS.length);
    expect(features).toHaveLength(PLANS.length * 3);
    expect(checks).toHaveLength(PLANS.length * 3);
  });

  it("leads every plan to the registration", () => {
    render(<PricingSection />);

    const links = screen.getAllByRole("link");

    expect(links).toHaveLength(PLANS.length);
    for (const link of links) {
      expect(link.getAttribute("href")).toContain("/register?plan=");
    }
  });
});

describe("FaqSection", () => {
  it("shows the title and every question of the design", () => {
    render(<FaqSection />);

    expect(
      screen.getByRole("heading", { name: "Frequently asked questions" })
    ).toBeInTheDocument();

    const questions = screen
      .getAllByRole("group")
      .map((item) => item.querySelector("summary")?.textContent);

    expect(questions).toEqual([
      "Do I need coding experience?",
      "What is NEXORA?",
      "Can I connect my own knowledge sources?",
    ]);
  });
});

describe("SolutionsSection", () => {
  it("shows the banner of the design", () => {
    render(<SolutionsSection />);

    expect(
      screen.getByRole("heading", { name: "See solutions in action" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Get Started Free/ })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Talk to Sales" })).toBeInTheDocument();
  });

  it("answers the questions about the solutions", () => {
    render(<SolutionsSection />);

    const questions = screen
      .getAllByRole("group")
      .map((item) => item.querySelector("summary")?.textContent);

    expect(questions).toHaveLength(4);
    expect(questions[0]).toContain("Can NEXORA be used for my industry?");
  });
});

describe("SecuritySection", () => {
  it("lists the safeguards of the platform", () => {
    const { container } = render(<SecuritySection />);

    expect(screen.getByRole("heading", { name: "Security" })).toBeInTheDocument();
    expect(container.querySelectorAll(".nx-security-card")).toHaveLength(6);
  });

  it("leads to the settings and to the contact section", () => {
    render(<SecuritySection />);

    const links = screen.getAllByRole("link");

    expect(links).toHaveLength(2);
    expect(links[0].getAttribute("href")).toBe("/dashboard/settings");
    expect(links[1].getAttribute("href")).toBe("#contact");
  });
});

describe("ContactSection", () => {
  it("shows the form of the design", () => {
    render(<ContactSection />);

    expect(
      screen.getByRole("heading", { name: "Get in touch" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Full Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Work Email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Subject/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Message/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send Message" })
    ).toBeInTheDocument();
  });

  it("lists the contact channels", () => {
    const { container } = render(<ContactSection />);

    expect(container.querySelectorAll(".nx-contact-item")).toHaveLength(4);
    expect(container.querySelectorAll(".nx-contact-social")).toHaveLength(4);
  });
});

describe("CallToAction", () => {
  it("closes the page with the registration and the footer links", () => {
    render(<CallToAction />);

    expect(
      screen.getByRole("heading", { name: "Ready to build with NEXORA?" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Get Started Free/ })).toBeInTheDocument();

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(5);
  });
});
