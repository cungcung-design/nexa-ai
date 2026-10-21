import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PasswordRecoveryFlow } from "@/components/public/password-recovery-flow";

type FetchAnswer = {
  ok: boolean;
  body: Record<string, unknown>;
};

function stubFetch(answers: Record<string, FetchAnswer>) {
  const fetchMock = vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<unknown>
  >(async (input) => {
    const url = String(input);
    const answer = answers[url] ?? {
      ok: false,
      body: { error: "Unknown route" },
    };
    return {
      ok: answer.ok,
      status: answer.ok ? 200 : 400,
      json: async () => answer.body,
    };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function readBody(call: unknown[] | undefined): Record<string, unknown> {
  const init = call?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body ?? "{}"));
}

describe("PasswordRecoveryFlow", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks for a reset link and shows that the email is on its way", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch({
      "/api/auth/password-reset/request": {
        ok: true,
        body: {
          ok: true,
          message: "If an account exists, a link is on its way.",
          resendAvailableInSeconds: 0,
        },
      },
    });
    render(<PasswordRecoveryFlow />);

    expect(
      screen.getByRole("heading", { name: "Forgot your password?" })
    ).toBeInTheDocument();

    await user.type(
      screen.getByLabelText("Email address"),
      "ada@example.com"
    );
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/password-reset/request",
      expect.objectContaining({ method: "POST" })
    );
    const body = readBody(fetchMock.mock.calls[0]);
    expect(body.email).toBe("ada@example.com");

    expect(
      await screen.findByRole("heading", { name: "Check your inbox" })
    ).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
  });

  it("keeps the resend button closed while the cooldown runs", async () => {
    const user = userEvent.setup();
    stubFetch({
      "/api/auth/password-reset/request": {
        ok: true,
        body: {
          ok: true,
          message: "If an account exists, a link is on its way.",
          resendAvailableInSeconds: 42,
        },
      },
    });
    render(<PasswordRecoveryFlow />);

    await user.type(
      screen.getByLabelText("Email address"),
      "ada@example.com"
    );
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    const resend = await screen.findByRole("button", { name: /Resend email/ });
    expect(resend).toBeDisabled();
    expect(resend).toHaveTextContent("42s");
  });

  it("shows the error of a refused request and stays on the first stage", async () => {
    const user = userEvent.setup();
    stubFetch({
      "/api/auth/password-reset/request": {
        ok: false,
        body: { error: "The reset email could not be sent." },
      },
    });
    render(<PasswordRecoveryFlow />);

    await user.type(
      screen.getByLabelText("Email address"),
      "ada@example.com"
    );
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The reset email could not be sent."
    );
    expect(
      screen.getByRole("heading", { name: "Forgot your password?" })
    ).toBeInTheDocument();
  });

  it("checks a link that arrives in the address bar before the form is shown", async () => {
    stubFetch({
      "/api/auth/password-reset/validate": {
        ok: true,
        body: { ok: true, valid: true, expiresInMinutes: 30 },
      },
    });
    render(<PasswordRecoveryFlow initialToken="a-token" />);

    expect(
      await screen.findByRole("heading", { name: "Choose a new password" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm new password")).toBeInTheDocument();
  });

  it("refuses a link that is invalid or expired", async () => {
    stubFetch({
      "/api/auth/password-reset/validate": {
        ok: false,
        body: { error: "This reset link is invalid or has expired." },
      },
    });
    render(<PasswordRecoveryFlow initialToken="a-token" />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This reset link is invalid or has expired."
    );
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  });

  it("refuses two passwords that do not match", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch({
      "/api/auth/password-reset/validate": {
        ok: true,
        body: { ok: true, valid: true, expiresInMinutes: 30 },
      },
    });
    render(<PasswordRecoveryFlow initialToken="a-token" />);

    await screen.findByRole("heading", { name: "Choose a new password" });
    await user.type(
      screen.getByLabelText("New password"),
      "a-very-long-password"
    );
    await user.type(
      screen.getByLabelText("Confirm new password"),
      "another-very-long-password"
    );
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The two passwords do not match."
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/auth/password-reset/confirm",
      expect.anything()
    );
  });

  it("stores the new password and ends on the last stage", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch({
      "/api/auth/password-reset/validate": {
        ok: true,
        body: { ok: true, valid: true, expiresInMinutes: 30 },
      },
      "/api/auth/password-reset/confirm": {
        ok: true,
        body: { ok: true },
      },
    });
    render(<PasswordRecoveryFlow initialToken="a-token" />);

    await screen.findByRole("heading", { name: "Choose a new password" });
    await user.type(
      screen.getByLabelText("New password"),
      "a-very-long-password"
    );
    await user.type(
      screen.getByLabelText("Confirm new password"),
      "a-very-long-password"
    );
    await user.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Password updated" })
      ).toBeInTheDocument()
    );
    const confirmCall = fetchMock.mock.calls.find(
      (call) => String(call[0]) === "/api/auth/password-reset/confirm"
    );
    expect(confirmCall).toBeDefined();
    const body = readBody(confirmCall);
    expect(body.token).toBe("a-token");
    expect(body.password).toBe("a-very-long-password");
    expect(screen.getByRole("link", { name: "Back to login" })).toHaveAttribute(
      "href",
      "/login"
    );
  });

  it("marks the stage of the flow and keeps the steps out of reach", async () => {
    const user = userEvent.setup();
    stubFetch({
      "/api/auth/password-reset/request": {
        ok: true,
        body: {
          ok: true,
          message: "If an account exists, a link is on its way.",
          resendAvailableInSeconds: 0,
        },
      },
    });
    render(<PasswordRecoveryFlow />);

    const steps = screen.getByRole("list", { name: "Password reset progress" });
    expect(steps).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
    // The steps are indicators, never links or buttons.
    expect(
      screen.queryByRole("button", { name: "Email sent" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Email sent" })
    ).not.toBeInTheDocument();

    await user.type(
      screen.getByLabelText("Email address"),
      "ada@example.com"
    );
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    await screen.findByRole("heading", { name: "Check your inbox" });
    expect(
      document.querySelector("[aria-current='step']")
    ).toHaveTextContent("2");
  });
});
