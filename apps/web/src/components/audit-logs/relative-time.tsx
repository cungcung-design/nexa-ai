"use client";

import { useSyncExternalStore } from "react";
import {
  formatRelative,
  formatTimestamp,
} from "@/components/audit-logs/shared";

/**
 * The relative age of an event is only known in the browser.
 *
 * The server render stays deterministic by showing the absolute timestamp and
 * the client swaps it for the relative label after hydration, so a prerender
 * never depends on the current time.
 */
const subscribe = () => () => {};

export function RelativeTime({ iso }: { iso: string }) {
  const label = useSyncExternalStore(
    subscribe,
    () => formatRelative(iso),
    () => formatTimestamp(iso)
  );
  return <>{label}</>;
}
