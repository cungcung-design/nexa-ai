import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/settings",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

import { SettingsDashboard } from "@/components/settings/settings-dashboard";

describe("Settings dashboard", () => {
  it("shows the personal and the workspace destinations", () => {
    render(<SettingsDashboard organizationId="org-1" />);

    expect(screen.getByText("Personal")).toBeInTheDocument();
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(screen.getByText("For you")).toBeInTheDocument();
    expect(screen.getByText("For your team")).toBeInTheDocument();
    expect(screen.getByText("My Profile")).toBeInTheDocument();
    expect(screen.getByText("Account Security")).toBeInTheDocument();
    expect(screen.getByText("Advanced")).toBeInTheDocument();
    expect(
      screen.getByText(
        "View and edit your personal information, avatar, and display name."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("Configure and manage your workspace settings.")
    ).toBeInTheDocument();
  });

  it("links every destination of the dashboard", () => {
    render(<SettingsDashboard organizationId="org-1" />);

    expect(screen.getByRole("link", { name: /My Profile/ })).toHaveAttribute(
      "href",
      "/dashboard/settings/profile"
    );
    expect(screen.getByRole("link", { name: /AI Configuration/ })).toHaveAttribute(
      "href",
      "/dashboard/organizations/org-1/settings/ai"
    );
  });

  it("filters the destinations and shows the empty state", async () => {
    const user = userEvent.setup();
    render(<SettingsDashboard organizationId="org-1" />);

    await user.type(screen.getByLabelText("Search settings"), "notification");
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.queryByText("My Profile")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Search settings"));
    await user.type(screen.getByLabelText("Search settings"), "zzz");
    expect(screen.getByText("No matching settings.")).toBeInTheDocument();
  });
});
