/**
 * Our account at the supplier (spec 8.27, 8.32): the balance check and when
 * each sync last ran. Shared by the profit report, the price list and the
 * Yesim connection page so they always show the same figures.
 */
import { forEachPackageDay, round2 } from "./rating";
import type { DState } from "./model";

/** Scheduled price list sync: about two hours ago, unless someone ran it since. */
const SCHEDULED_SYNC_MIN = 127;

export function priceListSyncedAt(s: DState, now = Date.now()) {
  return s.jobRuns.price_list_sync ?? new Date(now - SCHEDULED_SYNC_MIN * 60000).toISOString();
}

/** Deposits minus the Yesim cost of all usage to date, against the balance Yesim reports. */
export function supplierBalance(s: DState) {
  let costToDate = 0;
  forEachPackageDay(s, (_p, _d, lines) => lines.forEach((l) => (costToDate += l.cost)));
  const deposits = s.supplier.deposits.reduce((a, d) => a + d.amount, 0);
  const implied = deposits - costToDate;
  return {
    deposits: round2(deposits),
    costToDate: round2(costToDate),
    implied: round2(implied),
    reported: s.supplier.reportedBalance,
    difference: round2(s.supplier.reportedBalance - implied),
    tolerance: s.supplier.tolerance,
    reportedAt: s.supplier.reportedAt,
  };
}
