import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PublicHeader } from "@/components/public/public-header";

const nav = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
}));

const LINKS = [
  ["Product", "/#product"],
  ["Features", "/features"],
  ["Solutions", "/solutions"],
  ["Pricing", "/pricing"],
  ["Security", "/security"],
  ["Contact", "/contact"],
] as const;

describe("public navigation", () => {
  it("keeps login, registration, and the marketing routes available", () => {
    nav.pathname = "/";
    render(<PublicHeader />);

    expect(screen.getByRole("link", { name: "NEXORA home" })).toHaveAttribute(
      "href",
      "/"
    );
    expect(screen.getByRole("link", { name: "Log In" })).toHaveAttribute(
      "href",
      "/login"
    );
    expect(screen.getByRole("link", { name: "Get Started" })).toHaveAttribute(
      "href",
      "/register"
    );

    const menu = screen.getByRole("navigation", { name: "Main navigation" });
    const button = screen.getByRole("button", { name: "Open menu" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAttribute("aria-controls", menu.id);

    for (const [label, href] of LINKS) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
  });

  it("opens from the keyboard and closes on Escape", async () => {
    nav.pathname = "/";
    const user = userEvent.setup();
    render(<PublicHeader />);

    const button = screen.getByRole("button", { name: "Open menu" });
    button.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(screen.getByRole("link", { name: "Product" })).toHaveFocus();

    await user.keyboard("{Escape}");

    const closed = screen.getByRole("button", { name: "Open menu" });
    expect(closed).toHaveAttribute("aria-expanded", "false");
    expect(closed).toHaveFocus();
  });

  it("closes the menu when the route changes", async () => {
    nav.pathname = "/";
    const user = userEvent.setup();
    const view = render(<PublicHeader />);

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("button", { name: "Close menu" })).toBeInTheDocument();

    nav.pathname = "/features";
    view.rerender(<PublicHeader />);

    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });
});
