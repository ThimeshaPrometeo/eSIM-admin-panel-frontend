/**
 * Booked money per usage line: the one formula Profit and costs, the
 * dashboard and the reseller views share, so they agree to the cent.
 *
 * A package-day is booked once (lib/demo/rating):
 *   revenue = the cent-rounded reseller charge, or the retail price for direct sales
 *   cost    = Yesim cost of its lines
 * and split over that day's network lines in proportion to each line's
 * revenue (for revenue) and amount (for what the buyer's wallet paid).
 */
import { forEachPackageDay, type RatedLine } from "./rating";
import type { DPackage, DState } from "./model";

export type BookedLine = RatedLine & {
  /** Our revenue for this line. */
  booked: number;
  /** What the buyer's wallet paid for this line (reseller spend; Yesim cost for direct sales). */
  charged: number;
};

export type BookedFilter = {
  from?: string;
  to?: string;
  /** A reseller, "direct" for direct sales, or null / undefined for everyone. */
  resellerId?: string | "direct" | null;
  planId?: string | null;
  iso2?: string | null;
  networkId?: string | null;
};

export function forEachBookedLine(s: DState, fn: (l: BookedLine, p: DPackage, owner: string | null) => void, f: BookedFilter = {}) {
  forEachPackageDay(
    s,
    (p, _date, lines, charge, owner) => {
      const dayRevenue = owner === null ? lines.reduce((a, l) => a + l.revenue, 0) : charge;
      const lineRevenue = lines.reduce((a, l) => a + l.revenue, 0) || 1;
      const lineAmount = lines.reduce((a, l) => a + l.amount, 0) || 1;
      for (const l of lines) {
        if (f.iso2 && l.iso2 !== f.iso2) continue;
        if (f.networkId && l.networkId !== f.networkId) continue;
        fn({ ...l, booked: dayRevenue * (l.revenue / lineRevenue), charged: charge * (l.amount / lineAmount) }, p, owner);
      }
    },
    {
      from: f.from,
      to: f.to,
      packages: (p, owner) =>
        (!f.planId || p.planId === f.planId) && (!f.resellerId ? true : f.resellerId === "direct" ? owner === null : owner === f.resellerId),
    },
  );
}
