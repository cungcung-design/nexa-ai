"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  UserPlus,
} from "lucide-react";

export function LoginForm({ mode }: { mode: "login" | "register" }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(
        mode === "login"
          ? "/api/auth/login"
          : "/api/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: form.get("email"),
            password: form.get("password"),
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Request failed");
        return;
      }
      if (!data.ok) {
        setError("Authentication service returned an unexpected response.");
        return;
      }
      window.location.assign("/dashboard");
    } catch {
      setError("Network error. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  const isRegister = mode === "register";

  return (
    <form onSubmit={submit} className="space-y-5">
      <label className="block text-sm font-medium text-slate-700">
        Email address
        <input
          required
          type="email"
          name="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/15"
          placeholder="you@company.com"
        />
      </label>
      <div>
        <label
          htmlFor="auth-password"
          className="block text-sm font-medium text-slate-700"
        >
          Password
        </label>
        <div className="relative mt-2">
          <input
            id="auth-password"
            required
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete={isRegister ? "new-password" : "current-password"}
            minLength={isRegister ? 12 : undefined}
            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 pr-12 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/15"
            placeholder={isRegister ? "At least 12 characters" : "Enter your password"}
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-slate-500 hover:text-slate-900"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {!isRegister && (
          <div className="mt-2 text-right">
            <Link
              href="/password-recovery"
              className="rounded text-sm font-medium text-indigo-700 hover:text-indigo-800"
            >
              Forgot password?
            </Link>
          </div>
        )}
      </div>
      {isRegister && (
        <p className="text-xs leading-5 text-slate-500">
          Your account is created against the real FastAPI backend; you are
          signed in immediately afterwards.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      <button
        disabled={busy}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
      >
        {busy ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : isRegister ? (
          <UserPlus className="size-4" />
        ) : (
          <LockKeyhole className="size-4" />
        )}
        {isRegister ? "Create account" : "Sign in"}
        <ArrowRight className="size-4" />
      </button>
      <p className="text-center text-sm text-slate-600">
        {isRegister ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-indigo-700 hover:text-indigo-800">
              Sign in
            </Link>
          </>
        ) : (
          <>
            Need an account?{" "}
            <Link href="/register" className="font-medium text-indigo-700 hover:text-indigo-800">
              Register
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
