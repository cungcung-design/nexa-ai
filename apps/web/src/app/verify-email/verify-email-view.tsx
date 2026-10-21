"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type VerificationStatus = {
  email: string;
  verified: boolean;
  cooldown_seconds: number;
};

type SendResponse = {
  sent: boolean;
  email: string;
  cooldown_seconds: number;
  retry_after_seconds: number;
  delivery: string;
  verification_url: string | null;
};

const EMAIL_PROVIDERS: { label: string; url: string }[] = [
  { label: "Gmail", url: "https://mail.google.com/" },
  { label: "Outlook", url: "https://outlook.live.com/mail/" },
  { label: "Yahoo Mail", url: "https://mail.yahoo.com/" },
];

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/**
 * The address confirmation of a new account.
 *
 * The page shows the address of the signed in user, sends a new verification
 * email, and confirms the address with the token of the link in the inbox.
 */
export function VerifyEmailView({ token }: { token: string | null }) {
  const [email, setEmail] = useState("");
  const [verified, setVerified] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const confirmed = useRef(false);

  // The countdown of the resend button.
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setInterval(
      () => setCountdown((value) => Math.max(0, value - 1)),
      1000
    );
    return () => window.clearInterval(timer);
  }, [countdown]);

  // The status of the address of the signed in user.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await fetch("/api/auth/verification", {
        cache: "no-store",
      });
      if (!response.ok) {
        if (!cancelled) {
          setError("Sign in to confirm your email address.");
        }
        return;
      }
      const data = (await response.json()) as VerificationStatus;
      if (cancelled) return;
      setEmail(data.email);
      setVerified(data.verified);
      setCountdown(data.cooldown_seconds);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The token of the verification link.
  const confirm = useCallback(async (value: string) => {
    setBusy(true);
    setError("");
    setStatus("Checking the verification link...");
    try {
      const response = await fetch("/api/auth/verification/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus("");
        setError(
          typeof data.detail === "string"
            ? data.detail
            : "This verification link is not valid."
        );
        return;
      }
      setStatus("Your email address is confirmed.");
      setVerified(true);
    } catch {
      setStatus("");
      setError("Network error. Please retry.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!token || confirmed.current) return;
    confirmed.current = true;
    void confirm(token);
  }, [token, confirm]);

  async function resend() {
    if (busy || countdown > 0) return;
    setBusy(true);
    setError("");
    setStatus("Sending a new verification email...");
    try {
      const response = await fetch("/api/auth/verification/send", {
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as SendResponse & {
        detail?: string;
      };
      if (!response.ok) {
        setStatus("");
        setError(
          typeof data.detail === "string"
            ? data.detail
            : "The verification email could not be sent."
        );
        return;
      }
      setStatus("A new verification email is on its way.");
      setCountdown(data.retry_after_seconds || 45);
      setLink(data.verification_url ?? null);
    } catch {
      setStatus("");
      setError("Network error. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  const provider = EMAIL_PROVIDERS[0];

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-[#fafcff] to-[#f3f4ff] p-6 text-[#21194c] font-sans antialiased">
      <div className="w-full max-w-[360px] rounded-[13px] border border-[#e8eafa] bg-white/90 p-[28px_24px_35px] text-center shadow-lg">
        <div className="mx-auto mb-4 grid h-[68px] w-[68px] place-items-center rounded-[21px] bg-gradient-to-br from-[#eee9ff] to-[#e6e0ff] text-[#7948ff]">
          <svg
            className="h-[36px] w-[36px] fill-none stroke-current stroke-[2] stroke-linecap-round stroke-linejoin-round"
            viewBox="0 0 32 32"
            aria-hidden="true"
          >
            <rect x="4" y="6" width="24" height="20" rx="1.5" />
            <path d="m5 8 11 9L27 8M5 24l8-9m14 9-8-9" />
          </svg>
        </div>

        <h1 className="m-[0_0_11px] text-[23px] font-bold leading-[1.25] tracking-tight text-[#171717]">
          {verified ? "Email confirmed" : "Check your email"}
        </h1>

        {verified ? (
          <p className="m-0 text-[13px] leading-[1.6] text-[#8a839e]">
            Your email address is confirmed. Continue with the setup of your
            workspace.
          </p>
        ) : (
          <p className="m-0 text-[13px] leading-[1.6] text-[#8a839e]">
            We&apos;ve sent a verification link to
            <strong className="block break-words font-semibold text-[#514767]">
              {email || "your email address"}.
            </strong>
          </p>
        )}

        {!verified && (
          <>
            <p className="m-[12px_0_18px] text-[12px] leading-[1.6] text-[#8a839e]">
              Click the link in the email to verify your account.
            </p>

            <a
              className="inline-flex min-h-[35px] min-w-[146px] items-center justify-center rounded-[6px] border border-[#9169ff] bg-gradient-to-r from-[#9361ff] to-[#7542ff] px-5 text-[12px] font-semibold text-white no-underline shadow-sm transition-all hover:brightness-105"
              href={provider.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Email
            </a>

            <button
              className="mx-auto mt-[14px] cursor-pointer border-0 bg-transparent p-0.5 font-sans text-[11px] text-[#8b71c6] disabled:cursor-default disabled:text-[#aaa1bc]"
              id="resendButton"
              type="button"
              onClick={resend}
              disabled={busy || countdown > 0}
            >
              {countdown > 0 ? (
                <>
                  Resend email (<span id="countdown">{formatCountdown(countdown)}</span>)
                </>
              ) : (
                "Resend email"
              )}
            </button>
          </>
        )}

        {link && !verified && (
          <p className="m-[12px_0_0] text-[11px] leading-[1.6] text-[#8a839e]">
            No mail server is configured in this environment, so the link is
            shown here:{" "}
            <Link className="font-semibold text-[#6940ee]" href={link}>
              open the verification link
            </Link>
          </p>
        )}

        <p
          className={`m-[12px_0_0] text-[11px] leading-[1.6] empty:hidden ${
            error ? "text-[#c2334d]" : "text-[#8a839e]"
          }`}
          id="status"
          role={error ? "alert" : "status"}
        >
          {error || status}
        </p>

        {verified && (
          <Link
            className="mt-4 inline-flex min-h-[35px] min-w-[146px] items-center justify-center rounded-[6px] border border-[#9169ff] bg-gradient-to-r from-[#9361ff] to-[#7542ff] px-5 text-[12px] font-semibold text-white no-underline shadow-sm transition-all hover:brightness-105"
            href="/onboarding/welcome"
          >
            Continue
          </Link>
        )}
      </div>
    </main>
  );
}
