import type { PlanState } from "./status";

/** Plans that are current on an eSIM (running, waiting or blocked), as opposed to expired or ended. */
export const LIVE_PLAN_STATES: PlanState[] = ["active", "pending_first_use", "awaiting_funds", "blocked_no_funds", "blocked_hold_used_up", "blocked_by_admin"];

export function isLive(state: PlanState) {
  return LIVE_PLAN_STATES.includes(state);
}
