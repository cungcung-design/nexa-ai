"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  fetchOnboardingState,
  type OnboardingState,
  type OnboardingStateResult,
} from "@/lib/onboarding";

/**
 * The onboarding progress of the signed in user.
 *
 * A missing session sends the visitor to the sign in page, every other
 * problem keeps the page and offers a retry, so a temporary failure never
 * throws the user out of the flow.
 */
export function useOnboardingState(href: string) {
  const router = useRouter();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const apply = useCallback(
    (result: OnboardingStateResult) => {
      if (result.ok) {
        setState(result.state);
        setError("");
        setLoading(false);
        if (!result.state.email_verified) router.replace("/verify-email");
        return;
      }
      setLoading(false);
      if (result.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(href)}`);
        return;
      }
      setError("The onboarding could not be loaded. Please retry.");
    },
    [href, router]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetchOnboardingState();
      if (cancelled) return;
      apply(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [apply]);

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await fetchOnboardingState();
    apply(result);
  }, [apply]);

  return { state, error, loading, reload };
}
