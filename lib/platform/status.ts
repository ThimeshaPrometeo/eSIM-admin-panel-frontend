/**
 * The one place that turns backend status values into UI labels and chip
 * tones (CONVENTIONS §7). Tones: positive (Emerald) = active/success/final,
 * warning = estimated/80%/low balance, danger = suspended/blocked/error,
 * neutral = expired/ended/inactive/in stock, info (Azure) = installed/pending.
 */
export type StatusTone = "positive" | "warning" | "danger" | "neutral" | "info";
export type StatusInfo = { label: string; tone: StatusTone };

export type EsimStatus = "ACTIVE" | "INACTIVE" | "DISCONNECTED" | "SUSPENDED" | "END_OF_LIFE" | "UNKNOWN";
export type SuspendedBy = "reseller" | "admin" | "rule";
export type InstallStatus =
  | "not_installed" | "downloaded" | "installed" | "enabled" | "disabled" | "deleted" | "error" | "unknown";
export type PlanState =
  | "awaiting_funds" | "blocked_no_funds" | "blocked_hold_used_up" | "blocked_by_admin"
  | "pending_first_use" | "active" | "expired" | "ended";
export type OrderStatus = "awaiting_funds" | "pending" | "completed" | "failed" | "needs_check" | "cancelled";
export type HoldStatus = "waiting" | "active" | "exhausted" | "ending" | "settled" | "released" | "cancelled";
export type ChargeStatus = "accruing" | "rated" | "posted";
export type TopupStatus = "pending" | "approved" | "rejected" | "cancelled";

export function esimStatus(status: EsimStatus, suspendedBy?: SuspendedBy | null): StatusInfo {
  switch (status) {
    case "ACTIVE": return { label: "Active", tone: "positive" };
    case "SUSPENDED":
      return {
        label: suspendedBy === "admin" ? "Suspended by admin" : suspendedBy === "rule" ? "Suspended by rule" : "Suspended by reseller",
        tone: "danger",
      };
    case "END_OF_LIFE": return { label: "End of life", tone: "neutral" };
    case "INACTIVE": return { label: "Inactive", tone: "neutral" };
    case "DISCONNECTED": return { label: "Disconnected", tone: "warning" };
    default: return { label: "Unknown", tone: "neutral" };
  }
}

/** Unknown install values show the supplier's raw string as is (spec 8.3). */
export function installStatus(status: InstallStatus, raw?: string | null): StatusInfo {
  const map: Record<InstallStatus, StatusInfo> = {
    not_installed: { label: "Not installed", tone: "neutral" },
    downloaded: { label: "Downloaded", tone: "info" },
    installed: { label: "Installed", tone: "info" },
    enabled: { label: "Enabled", tone: "positive" },
    disabled: { label: "Disabled", tone: "neutral" },
    deleted: { label: "Deleted", tone: "neutral" },
    error: { label: "Error", tone: "danger" },
    unknown: { label: raw || "Unknown", tone: "neutral" },
  };
  return map[status];
}

export const PLAN_STATE: Record<PlanState, StatusInfo> = {
  awaiting_funds: { label: "Awaiting funds", tone: "warning" },
  blocked_no_funds: { label: "Blocked: no funds", tone: "danger" },
  blocked_hold_used_up: { label: "Blocked: hold used up", tone: "danger" },
  blocked_by_admin: { label: "Blocked by admin", tone: "danger" },
  pending_first_use: { label: "Pending first use", tone: "info" },
  active: { label: "Active", tone: "positive" },
  expired: { label: "Expired", tone: "neutral" },
  ended: { label: "Ended", tone: "neutral" },
};

export const ORDER_STATUS: Record<OrderStatus, StatusInfo> = {
  awaiting_funds: { label: "Awaiting funds", tone: "warning" },
  pending: { label: "Pending", tone: "info" },
  completed: { label: "Completed", tone: "positive" },
  failed: { label: "Failed", tone: "danger" },
  needs_check: { label: "Being verified", tone: "warning" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export const HOLD_STATUS: Record<HoldStatus, StatusInfo> = {
  waiting: { label: "Waiting", tone: "warning" },
  active: { label: "Active", tone: "positive" },
  exhausted: { label: "Used up", tone: "danger" },
  ending: { label: "Ending", tone: "info" },
  settled: { label: "Settled", tone: "neutral" },
  released: { label: "Released", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export const CHARGE_STATUS: Record<ChargeStatus, StatusInfo> = {
  accruing: { label: "Estimated", tone: "warning" },
  rated: { label: "Final", tone: "positive" },
  posted: { label: "Final", tone: "positive" },
};

export const TOPUP_STATUS: Record<TopupStatus, StatusInfo> = {
  pending: { label: "Pending", tone: "info" },
  approved: { label: "Approved", tone: "positive" },
  rejected: { label: "Rejected", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

/** Usage bars and rings: normal below 80%, warning 80–99%, danger at 100%. */
export function usageTone(fraction: number): "normal" | "warning" | "danger" {
  if (fraction >= 1) return "danger";
  if (fraction >= 0.8) return "warning";
  return "normal";
}

export type AlertStatusValue = "open" | "acknowledged" | "resolved";
export const ALERT_STATUS: Record<AlertStatusValue, StatusInfo> = {
  open: { label: "Open", tone: "warning" },
  acknowledged: { label: "Acknowledged", tone: "info" },
  resolved: { label: "Resolved", tone: "neutral" },
};

/** Alert types (spec 8.9; definitive list from the backend: BB-11). */
export const ALERT_TYPE_LABEL: Record<
  "usage_threshold" | "low_stock" | "low_wallet" | "house_wallet_low" | "order_needs_check" | "unpriced_network_usage" | "usage_rating_late" | "plan_held_by_daily_limit" | "outstanding_balance" | "price_list_changed",
  string
> = {
  usage_threshold: "Usage threshold",
  low_stock: "Low stock",
  low_wallet: "Low wallet",
  house_wallet_low: "House wallet low",
  order_needs_check: "Order being verified",
  unpriced_network_usage: "Network with no price",
  usage_rating_late: "Late usage report",
  plan_held_by_daily_limit: "Daily sale limit",
  outstanding_balance: "Outstanding amount",
  price_list_changed: "Price list changed",
};
