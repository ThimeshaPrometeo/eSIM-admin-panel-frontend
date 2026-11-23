import type { StatusInfo } from "./status";

export const PLAN_STATUS: Record<"draft" | "active" | "inactive", StatusInfo> = {
  active: { label: "Active", tone: "positive" },
  draft: { label: "Draft", tone: "info" },
  inactive: { label: "Inactive", tone: "neutral" },
};

export const RESELLER_STATUS: Record<"active" | "suspended", StatusInfo> = {
  active: { label: "Active", tone: "positive" },
  suspended: { label: "Suspended", tone: "danger" },
};

export const USER_STATUS: Record<"active" | "disabled", StatusInfo> = {
  active: { label: "Active", tone: "positive" },
  disabled: { label: "Disabled", tone: "neutral" },
};
