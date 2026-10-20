/**
 * Money and number formatting for the billing screens.
 *
 * These helpers are pure and free of React, so server components can call
 * them directly. They live outside the client module that holds the billing
 * components on purpose: a client module cannot be invoked from a server
 * component.
 */

export function formatMoney(amount: number, currency = "usd") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount / 100);
  } catch {
    return `$${(amount / 100).toFixed(2)}`;
  }
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}
