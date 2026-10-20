/**
 * Date helpers for the billing screens.
 *
 * The formatting works on timestamps so the render never has to read the
 * current time, which keeps the pages prerenderable.
 */

const SHORT_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const LONG_DATE = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const DATE_TIME = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function timestamp(value?: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function formatShortDate(value?: string | null) {
  const time = timestamp(value);
  return time === null ? "—" : SHORT_DATE.format(time);
}

export function formatLongDate(value?: string | null) {
  const time = timestamp(value);
  return time === null ? "—" : LONG_DATE.format(time);
}

export function formatDateTime(value?: string | null) {
  const time = timestamp(value);
  return time === null ? "—" : DATE_TIME.format(time);
}
