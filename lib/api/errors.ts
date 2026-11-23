/**
 * API errors (CONVENTIONS §10). The backend answers `{ error: { code,
 * message, details } }`; demo mode throws the same codes so error UI is
 * built once. `errorMessage` turns a code into plain words that say what
 * happened and how to fix it.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
    public details?: Record<string, unknown>,
  ) {
    super(message ?? code);
    this.name = "ApiError";
  }
}

const MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Your session has ended. Sign in again.",
  INVALID_CREDENTIALS: "That username or password isn't right. After 10 failed attempts the account locks for 15 minutes.",
  INVITE_PENDING: "This account hasn't been set up yet. Use the invitation link we emailed you, or ask your administrator to send it again.",
  INVITE_EXPIRED: "This invitation has expired or was already used. Ask your administrator to send a new one.",
  RESET_LINK_EXPIRED: "This reset link has expired or was already used. Ask for a new one.",
  ACCOUNT_LOCKED: "This account is locked after 10 failed attempts. Try again in 15 minutes.",
  ACCOUNT_DISABLED: "This account is disabled. Ask your administrator.",
  INVALID_CODE: "That code isn't right. Check your authenticator app and try again.",
  PASSWORD_TOO_SHORT: "Use at least 10 characters.",
  FORBIDDEN: "You don't have access to this.",
  NOT_FOUND: "We couldn't find that. It may have been removed, or it's outside your access.",
  OUTSTANDING_BALANCE: "There's an outstanding amount on this wallet. New plans can't be ordered until it's paid with a top-up.",
  ACTIVATION_REQUIRES_FUNDS: "Your wallet doesn't cover the hold, so only “On first use” activation is possible.",
  ZONE_HAS_UNPRICED_NETWORKS: "This zone has networks without a price, so plans can't use it.",
  END_OF_LIFE_FINAL: "This eSIM is at end of life. Only the supplier can re-enable it.",
  DAILY_LIMIT_REACHED: "Today's sale limit is reached. Try again tomorrow.",
  SALE_CAP_REACHED: "The total sale cap is reached. Ask an administrator.",
  INSUFFICIENT_AVAILABLE: "That would take the wallet below its held amount. Wallets can never go negative.",
  INSUFFICIENT_FUNDS: "The wallet doesn't have enough available to grow the hold.",
  RESELLER_SUSPENDED: "This reseller is suspended, so nothing can be sold.",
  NOT_PENDING: "This request was already decided.",
  REACTIVATE_NOT_ALLOWED: "Only an administrator can lift this suspension.",
  USERNAME_TAKEN: "That username is already used.",
  DUPLICATE_DISCOUNT: "This reseller already has a discount for that plan.",
  GRANT_ABOVE_ENVELOPE: "One of these permissions is more than the reseller has.",
  DEMO_ONLY: "This works in demo mode only.",
  NETWORK: "We couldn't reach the server. Check your connection and try again.",
};

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return MESSAGES[e.code] ?? e.message ?? "Something went wrong. Try again.";
  return "Something went wrong. Try again.";
}
