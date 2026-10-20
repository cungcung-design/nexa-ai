import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AuthForm } from "@/components/public/auth-form";

describe("AuthForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the sign in through the same origin auth proxy", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Cannot reach authentication service." }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AuthForm mode="login" />);

    await user.type(screen.getByLabelText("Email Address"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "not-a-real-password");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.email).toBe("test@example.com");
    expect(body.password).toBe("not-a-real-password");
    expect(body.remember).toBe(true);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Cannot reach authentication service."
    );
  });

  it("sends the sign up with the full name through the same origin auth proxy", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Registration failed." }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AuthForm mode="register" />);

    await user.type(screen.getByLabelText("Full Name"), "Ada Lovelace");
    await user.type(screen.getByLabelText("Work Email"), "new@example.com");
    await user.type(
      screen.getByLabelText("Password"),
      "a-very-long-password"
    );
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/register",
      expect.objectContaining({ method: "POST" })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual({
      name: "Ada Lovelace",
      email: "new@example.com",
      password: "a-very-long-password",
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Registration failed."
    );
  });

  it("allows the password to be revealed", async () => {
    const user = userEvent.setup();
    render(<AuthForm mode="login" />);

    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
  });

  it("refuses a sign up with a password that is too short", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<AuthForm mode="register" />);

    await user.type(screen.getByLabelText("Full Name"), "Ada Lovelace");
    await user.type(screen.getByLabelText("Work Email"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "short");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Password must be at least 12 characters."
    );
  });

  it("refuses a sign up without the terms", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<AuthForm mode="register" />);

    await user.type(screen.getByLabelText("Full Name"), "Ada Lovelace");
    await user.type(screen.getByLabelText("Work Email"), "new@example.com");
    await user.type(
      screen.getByLabelText("Password"),
      "a-very-long-password"
    );
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You have to accept the Terms of Service and the Privacy Policy."
    );
  });

  it("explains that the google sign in is not connected", async () => {
    const user = userEvent.setup();
    render(<AuthForm mode="login" />);

    await user.click(
      screen.getByRole("button", { name: "Continue with Google" })
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Google sign in is not connected to this workspace yet."
    );
  });

  it("links the two pages to each other", () => {
    const { unmount } = render(<AuthForm mode="login" />);
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/register"
    );
    unmount();

    render(<AuthForm mode="register" />);
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login"
    );
  });
});
