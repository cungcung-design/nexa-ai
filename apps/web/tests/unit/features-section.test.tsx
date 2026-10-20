import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { FeaturesSection } from "@/components/public/features-section";

const FEATURES = [
  {
    title: "AI Agents",
    description: "Build configurable agents with tools and knowledge.",
  },
  {
    title: "Workflows",
    description: "Design multi-step automations.",
  },
  {
    title: "Knowledge Base",
    description: "Connect documents and trusted sources.",
  },
  {
    title: "Integrations",
    description: "Link your favorite tools and services.",
  },
  {
    title: "Conversations",
    description: "A unified workspace to interact and collaborate.",
  },
  {
    title: "Human Approvals",
    description: "Add review steps for sensitive actions.",
  },
  {
    title: "Analytics",
    description: "Understand usage and performance.",
  },
  {
    title: "Audit Logs",
    description: "Track activity and changes with full visibility.",
  },
];

describe("FeaturesSection", () => {
  it("lists every feature of the design in order", () => {
    render(<FeaturesSection />);

    const headings = screen.getAllByRole("heading", { level: 3 });

    expect(headings).toHaveLength(FEATURES.length);
    expect(headings.map((heading) => heading.textContent)).toEqual(
      FEATURES.map((feature) => feature.title)
    );
  });

  it("shows the description of every feature", () => {
    render(<FeaturesSection />);

    for (const feature of FEATURES) {
      expect(screen.getByText(feature.description)).toBeInTheDocument();
    }
  });

  it("renders one icon per feature", () => {
    const { container } = render(<FeaturesSection />);

    const icons = container.querySelectorAll("section svg");

    expect(icons).toHaveLength(FEATURES.length);

    for (const icon of icons) {
      expect(icon).toHaveAttribute("viewBox", "0 0 24 24");
    }
  });

  it("uses the grid of the design", () => {
    const { container } = render(<FeaturesSection />);

    const grid = container.querySelector("section > div.grid");

    expect(grid).toHaveClass("grid");
    expect(grid).toHaveClass("max-w-[1000px]");
    expect(grid).toHaveClass("grid-cols-1");
    expect(grid).toHaveClass("sm:grid-cols-2");
    expect(grid).toHaveClass("lg:grid-cols-4");
    expect(grid).toHaveClass("gap-4");
  });
});
