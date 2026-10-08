/**
 * Firm JWTs with expired/cancelled billing may still hit these paths
 * so owners can open Checkout / Portal / read their quote.
 */
export function isBillingExemptPath(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split('?')[0] ?? '';
  return (
    /\/billing\/(checkout|portal|quote)\/?$/.test(path) ||
    /\/auth\/(logout|refresh|session|profile)\/?$/.test(path)
  );
}
