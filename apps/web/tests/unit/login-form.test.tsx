import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "@/components/login-form";

describe("LoginForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends login through the same-origin auth proxy", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Cannot reach authentication service." }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<LoginForm mode="login" />);

    await user.type(screen.getByLabelText("Email address"), "test@example.invalid");
    await user.type(screen.getByLabelText("Password"), "not-a-real-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent("Cannot reach authentication service.");
  });

  it("sends registration through the same-origin auth proxy", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Registration failed." }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<LoginForm mode="register" />);

    await user.type(screen.getByLabelText("Email address"), "new@example.invalid");
    await user.type(screen.getByLabelText("Password"), "not-a-real-password");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/register",
      expect.objectContaining({ method: "POST" })
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Registration failed."
    );
  });

  it("allows the password to be revealed", async () => {
    const user = userEvent.setup();
    render(<LoginForm mode="login" />);

    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
  });
});
