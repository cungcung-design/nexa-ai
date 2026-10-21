"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import { EyeIcon, GoogleIcon } from "@/components/public/auth-icons";
import { resolveAfterAuth } from "@/lib/onboarding";

const MIN_PASSWORD_LENGTH = 12;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AuthMode = "login" | "register";

/**
 * The sign in and the sign up form.
 *
 * Both forms post to the same origin authentication proxy, which forwards the
 * credentials to the NEXORA backend and stores the session cookie.
 */
export function AuthForm({ mode, next }: { mode: AuthMode; next?: string }) {
  const isRegister = mode === "register";
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();

    setError("");
    setStatus("");

    if (!email || !password) {
      setError("Email address and password are required.");
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      setError("Enter a valid email address.");
      return;
    }

    if (isRegister) {
      if (!name) {
        setError("Full name is required.");
        return;
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        return;
      }
      if (!form.get("terms")) {
        setError("You have to accept the Terms of Service and the Privacy Policy.");
        return;
      }
    }

    setBusy(true);
    setStatus(isRegister ? "Creating your account..." : "Signing in...");

    try {
      const response = await fetch(
        isRegister ? "/api/auth/register" : "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isRegister
              ? { name, email, password }
              : { email, password, remember: form.get("remember") === "on" }
          ),
        }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(
          typeof data.error === "string" && data.error
            ? data.error
            : "The request could not be completed. Please try again."
        );
        setStatus("");
        return;
      }
      if (!data.ok) {
        setError("The authentication service returned an unexpected response.");
        setStatus("");
        return;
      }

      setStatus(
        isRegister
          ? "Account created. Confirm your email address..."
          : "Signed in. Redirecting to your workspace..."
      );
      // A new account confirms the address first, an account that still runs
      // through the onboarding continues there.
      const target = isRegister
        ? "/verify-email"
        : await resolveAfterAuth(next);
      window.location.assign(target);
    } catch {
      setError("Network error. Please retry.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  function showGoogleNotice() {
    setError("");
    setStatus(
      "Google sign in is not connected to this workspace yet. Use your email and password to continue."
    );
  }

  return (
    <>
      <form onSubmit={submit} noValidate>
        {isRegister && (
          <div className="nx-auth-field">
            <label htmlFor="auth-name">Full Name</label>
            <input
              className="nx-auth-input"
              id="auth-name"
              name="name"
              type="text"
              placeholder="Your full name"
              autoComplete="name"
              required
            />
          </div>
        )}

        <div className="nx-auth-field">
          <label htmlFor="auth-email">
            {isRegister ? "Work Email" : "Email Address"}
          </label>
          <input
            className="nx-auth-input"
            id="auth-email"
            name="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            required
          />
        </div>

        <div className="nx-auth-field">
          <label htmlFor="auth-password">Password</label>
          <div className="nx-auth-input-wrap">
            <input
              className="nx-auth-input nx-auth-password-input"
              id="auth-password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder={
                isRegister ? "Create a secure password" : "Your password"
              }
              autoComplete={isRegister ? "new-password" : "current-password"}
              minLength={isRegister ? MIN_PASSWORD_LENGTH : undefined}
              required
            />
            <button
              type="button"
              className="nx-auth-password-toggle"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              <EyeIcon className="nx-auth-icon" />
            </button>
          </div>
        </div>

        {isRegister ? (
          <label className="nx-auth-check-label nx-auth-terms">
            <input type="checkbox" name="terms" required />
            <span>
              I agree to the <Link href="/terms">Terms of Service</Link>
              and <Link href="/privacy">Privacy Policy</Link>.
            </span>
          </label>
        ) : (
          <div className="nx-auth-options">
            <label className="nx-auth-check-label">
              <input type="checkbox" name="remember" defaultChecked />
              <span>Remember me</span>
            </label>
            <Link href="/password-recovery">Forgot password?</Link>
          </div>
        )}

        <button className="nx-auth-submit" type="submit" disabled={busy}>
          {busy
            ? isRegister
              ? "Creating account..."
              : "Signing in..."
            : isRegister
              ? "Create Account"
              : "Sign In"}
        </button>

        <p
          className={`nx-auth-status${error ? " nx-auth-status-error" : ""}`}
          role={error ? "alert" : "status"}
        >
          {error || status}
        </p>
      </form>

      <div className="nx-auth-divider">OR</div>

      <button className="nx-auth-google" type="button" onClick={showGoogleNotice}>
        <GoogleIcon />
        Continue with Google
      </button>

      <p className="nx-auth-switch">
        {isRegister ? (
          <>
            Already have an account? <Link href="/login">Log in</Link>
          </>
        ) : (
          <>
            Don&apos;t have an account? <Link href="/register">Sign up</Link>
          </>
        )}
      </p>
    </>
  );
}
