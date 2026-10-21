"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  KeyRound,
  Mail,
  ShieldCheck,
} from "lucide-react";

/**
 * The four stages of the password reset flow.
 *
 * The indicator is not interactive: a stage is only reached by finishing the
 * step before it, so the flow can never be skipped.
 */
type Stage = "request" | "sent" | "reset" | "success";

const STAGES: { id: Stage; label: string }[] = [
  { id: "request", label: "Request" },
  { id: "sent", label: "Email sent" },
  { id: "reset", label: "New password" },
  { id: "success", label: "Finished" },
];

const MIN_PASSWORD_LENGTH = 12;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type TokenState = "none" | "checking" | "valid" | "invalid";

export function PasswordRecoveryFlow({
  initialToken = "",
}: {
  initialToken?: string;
}) {
  const [stage, setStage] = useState<Stage>("request");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(initialToken);
  const [tokenState, setTokenState] = useState<TokenState>(
    initialToken ? "checking" : "none"
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [devLink, setDevLink] = useState<string | null>(null);

  const currentIndex = useMemo(
    () => STAGES.findIndex((entry) => entry.id === stage),
    [stage]
  );

  // A link that arrives in the address bar is checked before the form is
  // shown, so a spent or expired link never asks for a new password.
  useEffect(() => {
    if (!initialToken) return;
    let cancelled = false;

    async function check() {
      try {
        const response = await fetch("/api/auth/password-reset/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: initialToken }),
        });
        if (cancelled) return;
        if (response.ok) {
          setTokenState("valid");
          setStage("reset");
          return;
        }
        setTokenState("invalid");
        setError(
          "This reset link is invalid or has expired. Request a new link to continue."
        );
      } catch {
        if (cancelled) return;
        setTokenState("invalid");
        setError("The reset link could not be checked. Please try again.");
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [initialToken]);

  // The cooldown of the backend is mirrored so the button explains why it
  // cannot be pressed yet.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setInterval(() => {
      setResendIn((seconds) => (seconds > 0 ? seconds - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendIn]);

  const clearTokenFromUrl = useCallback(() => {
    if (typeof window === "undefined") return;
    window.history.replaceState(null, "", "/password-recovery");
  }, []);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const form = new FormData(event.currentTarget);
    const address = String(form.get("email") ?? "").trim();
    setError("");
    setStatus("");

    if (!address) {
      setError("Email address is required.");
      return;
    }
    if (!EMAIL_PATTERN.test(address)) {
      setError("Enter a valid email address.");
      return;
    }

    setBusy(true);
    setStatus("Sending the reset link...");

    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(
          typeof data.error === "string" && data.error
            ? data.error
            : "The reset link could not be sent. Please try again."
        );
        setStatus("");
        return;
      }

      setEmail(address);
      setResendIn(
        typeof data.resendAvailableInSeconds === "number"
          ? data.resendAvailableInSeconds
          : 0
      );
      setDevLink(
        typeof data.devResetLink === "string" ? data.devResetLink : null
      );
      setStatus("");
      setStage("sent");
    } catch {
      setError("Network error. Please retry.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (busy || resendIn > 0 || !email) return;

    setBusy(true);
    setError("");
    setStatus("Sending the reset link again...");

    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(
          typeof data.error === "string" && data.error
            ? data.error
            : "The reset link could not be sent. Please try again."
        );
        setStatus("");
        return;
      }

      setResendIn(
        typeof data.resendAvailableInSeconds === "number"
          ? data.resendAvailableInSeconds
          : 0
      );
      setDevLink(
        typeof data.devResetLink === "string" ? data.devResetLink : null
      );
      setStatus("A new link is on its way.");
    } catch {
      setError("Network error. Please retry.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    setError("");
    setStatus("");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmation) {
      setError("The two passwords do not match.");
      return;
    }

    setBusy(true);
    setStatus("Updating your password...");

    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(
          typeof data.error === "string" && data.error
            ? data.error
            : "The password could not be updated. Please try again."
        );
        setStatus("");
        return;
      }

      clearTokenFromUrl();
      setStatus("");
      setStage("success");
    } catch {
      setError("Network error. Please retry.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  function startOver() {
    clearTokenFromUrl();
    setToken("");
    setTokenState("none");
    setError("");
    setStatus("");
    setStage("request");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#fafcff] to-[#f3f4ff] px-4 py-10">
      <div className="w-full max-w-[430px]">
        <ol
          className="flex items-center px-2"
          aria-label="Password reset progress"
        >
          {STAGES.map((entry, index) => {
            const state =
              index < currentIndex
                ? "done"
                : index === currentIndex
                  ? "current"
                  : "todo";
            return (
              <li
                key={entry.id}
                className="flex flex-1 items-center last:flex-none"
              >
                <span className="flex flex-col items-center gap-2">
                  <span
                    aria-current={state === "current" ? "step" : undefined}
                    className={[
                      "grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
                      state === "todo"
                        ? "bg-[#eef0fc] text-[#9c9ab5]"
                        : "bg-gradient-to-br from-[#a080ff] to-[#825dff] text-white",
                    ].join(" ")}
                  >
                    {state === "done" ? (
                      <Check className="size-3.5" strokeWidth={3} />
                    ) : (
                      index + 1
                    )}
                  </span>
                </span>
                {index < STAGES.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className={[
                      "mx-2 h-[3px] flex-1 rounded-full",
                      index < currentIndex
                        ? "bg-gradient-to-r from-[#a080ff] to-[#825dff]"
                        : "bg-[#eef0fc]",
                    ].join(" ")}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
        <p className="sr-only">
          {`Step ${currentIndex + 1} of ${STAGES.length}: ${
            STAGES[currentIndex]?.label ?? ""
          }`}
        </p>

        <section className="mt-7 rounded-2xl border border-[#eceaf7] bg-white p-7 shadow-[0_18px_60px_rgba(85,65,188,0.05)] sm:p-8">
          {stage === "request" && (
            <>
              <span className="mx-auto grid size-[53px] place-items-center rounded-xl bg-[#f0e9ff] text-[#8652ff]">
                <Mail className="size-6" strokeWidth={1.8} />
              </span>
              <h1 className="mt-5 text-[20px] font-semibold tracking-[-0.2px] text-[#171334]">
                Forgot your password?
              </h1>
              <p className="mt-2 text-[13px] leading-6 text-[#8a879f]">
                Enter the email address of your account and we will send you a
                link to choose a new password.
              </p>

              <form className="mt-6" onSubmit={submitRequest} noValidate>
                <div>
                  <label
                    className="mb-2 block text-[12px] font-semibold text-[#413b5c]"
                    htmlFor="recovery-email"
                  >
                    Email address
                  </label>
                  <input
                    className="h-[39px] w-full rounded-lg border border-[#e6e6f2] px-3 text-[13px] text-[#171334] outline-none transition placeholder:text-[#b2afc1] focus:border-[#aa8aff] focus:shadow-[0_0_0_3px_rgba(117,67,255,0.05)]"
                    id="recovery-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    required
                  />
                </div>

                <button
                  className="mt-5 h-[39px] w-full rounded-lg bg-gradient-to-r from-[#8e5aff] to-[#7844ff] text-[13px] font-semibold text-white shadow-[0_3px_8px_rgba(117,67,255,0.08)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                  type="submit"
                  disabled={busy}
                >
                  {busy ? "Sending..." : "Send reset link"}
                </button>

                <p
                  className={`mt-4 text-[12px] leading-5 ${
                    error ? "text-[#c2334d]" : "text-[#716888]"
                  }`}
                  role={error ? "alert" : "status"}
                >
                  {error || status}
                </p>
              </form>
            </>
          )}

          {stage === "sent" && (
            <>
              <span className="mx-auto grid size-[53px] place-items-center rounded-xl bg-[#f0e9ff] text-[#8652ff]">
                <Mail className="size-6" strokeWidth={1.8} />
              </span>
              <h1 className="mt-5 text-[20px] font-semibold tracking-[-0.2px] text-[#171334]">
                Check your inbox
              </h1>
              <p className="mt-2 text-[13px] leading-6 text-[#8a879f]">
                We sent a password reset link to{" "}
                <span className="font-semibold text-[#413b5c]">{email}</span>.
                The link expires in 30 minutes and can only be used once.
              </p>

              {devLink ? (
                <p className="mt-4 rounded-lg border border-[#f4e3b4] bg-[#fffaf0] p-3 text-[12px] leading-5 text-[#8a6d1f]">
                  Development mode without a mail server:{" "}
                  <a
                    className="font-semibold text-[#6d4aff] underline"
                    href={devLink}
                  >
                    open the reset link
                  </a>
                </p>
              ) : null}

              <button
                className="mt-6 h-[39px] w-full rounded-lg bg-gradient-to-r from-[#8e5aff] to-[#7844ff] text-[13px] font-semibold text-white shadow-[0_3px_8px_rgba(117,67,255,0.08)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={resend}
                disabled={busy || resendIn > 0}
              >
                {busy
                  ? "Sending..."
                  : resendIn > 0
                    ? `Resend email (${resendIn}s)`
                    : "Resend email"}
              </button>

              <p
                className={`mt-4 text-[12px] leading-5 ${
                  error ? "text-[#c2334d]" : "text-[#716888]"
                }`}
                role={error ? "alert" : "status"}
              >
                {error || status}
              </p>
            </>
          )}

          {stage === "reset" && (
            <>
              <span className="mx-auto grid size-[53px] place-items-center rounded-xl bg-[#f0e9ff] text-[#8652ff]">
                <KeyRound className="size-6" strokeWidth={1.8} />
              </span>
              <h1 className="mt-5 text-[20px] font-semibold tracking-[-0.2px] text-[#171334]">
                Choose a new password
              </h1>
              <p className="mt-2 text-[13px] leading-6 text-[#8a879f]">
                Your new password needs at least {MIN_PASSWORD_LENGTH}{" "}
                characters. Every session of your account is signed out.
              </p>

              <form className="mt-6" onSubmit={submitReset} noValidate>
                <div>
                  <label
                    className="mb-2 block text-[12px] font-semibold text-[#413b5c]"
                    htmlFor="recovery-password"
                  >
                    New password
                  </label>
                  <input
                    className="h-[39px] w-full rounded-lg border border-[#e6e6f2] px-3 text-[13px] text-[#171334] outline-none transition placeholder:text-[#b2afc1] focus:border-[#aa8aff] focus:shadow-[0_0_0_3px_rgba(117,67,255,0.05)]"
                    id="recovery-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={MIN_PASSWORD_LENGTH}
                    placeholder="Create a secure password"
                    required
                  />
                </div>
                <div className="mt-4">
                  <label
                    className="mb-2 block text-[12px] font-semibold text-[#413b5c]"
                    htmlFor="recovery-confirmation"
                  >
                    Confirm new password
                  </label>
                  <input
                    className="h-[39px] w-full rounded-lg border border-[#e6e6f2] px-3 text-[13px] text-[#171334] outline-none transition placeholder:text-[#b2afc1] focus:border-[#aa8aff] focus:shadow-[0_0_0_3px_rgba(117,67,255,0.05)]"
                    id="recovery-confirmation"
                    name="confirmation"
                    type="password"
                    autoComplete="new-password"
                    minLength={MIN_PASSWORD_LENGTH}
                    placeholder="Repeat the new password"
                    required
                  />
                </div>

                <button
                  className="mt-5 h-[39px] w-full rounded-lg bg-gradient-to-r from-[#8e5aff] to-[#7844ff] text-[13px] font-semibold text-white shadow-[0_3px_8px_rgba(117,67,255,0.08)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                  type="submit"
                  disabled={busy}
                >
                  {busy ? "Updating..." : "Update password"}
                </button>

                <p
                  className={`mt-4 text-[12px] leading-5 ${
                    error ? "text-[#c2334d]" : "text-[#716888]"
                  }`}
                  role={error ? "alert" : "status"}
                >
                  {error || status}
                </p>
              </form>
            </>
          )}

          {stage === "success" && (
            <>
              <span className="mx-auto grid size-[53px] place-items-center rounded-xl bg-[#f0e9ff] text-[#8652ff]">
                <ShieldCheck className="size-6" strokeWidth={1.8} />
              </span>
              <h1 className="mt-5 text-[20px] font-semibold tracking-[-0.2px] text-[#171334]">
                Password updated
              </h1>
              <p className="mt-2 text-[13px] leading-6 text-[#8a879f]">
                Your new password is active. Every session of your account was
                signed out, so please sign in again.
              </p>

              <Link
                className="mt-6 flex h-[39px] w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#8e5aff] to-[#7844ff] text-[13px] font-semibold text-white shadow-[0_3px_8px_rgba(117,67,255,0.08)] transition hover:brightness-105"
                href="/login"
              >
                <ArrowLeft className="size-4" strokeWidth={2} />
                Back to login
              </Link>
            </>
          )}

          {stage !== "success" ? (
            <p className="mt-6 text-center text-[12px] text-[#918ba5]">
              {stage === "reset" ? (
                <button
                  className="font-semibold text-[#6d4aff] underline-offset-2 hover:underline"
                  type="button"
                  onClick={startOver}
                >
                  Request a new link
                </button>
              ) : (
                <Link
                  className="font-semibold text-[#6d4aff] underline-offset-2 hover:underline"
                  href="/login"
                >
                  Back to login
                </Link>
              )}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
