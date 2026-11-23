/**
 * Rating: the one place usage becomes money (spec 8.32). Every usage line is
 * one package, one day, one network:
 *
 *   price per MB = Yesim €/MB × (1 + markup) × (1 − discount)
 *
 * with the Yesim price in force that day and the markup and discount in force
 * at the moment the data was used: a change applies from the moment it is
 * saved, so a day with a change is split there (the demo spreads a day's data
 * evenly over the day; today's runs up to when the demo data was made). Charges,
 * holds, the ledger, statements, the dashboard and the profit report are all
 * built from these lines, so every page agrees to the cent. A package's charge
 * for a day is the sum of its network lines, rounded to cents once.
 *
 * Direct sales are charged to the house wallet at Yesim cost; their revenue
 * is the retail price (Yesim × (1 + retail markup)).
 */
import { addDays } from "@/lib/platform/dates";
import { NETWORK_BY_ID } from "./catalogue";
import type { DPackage, DPriceVersion, DState } from "./model";

export type RatedLine = {
  date: string;
  packageId: string;
  esimId: string;
  planId: string;
  /** null = direct sale (house wallet). */
  resellerId: string | null;
  networkId: string;
  iso2: string;
  mb: number;
  /** Yesim €/MB that day. */
  costPerMb: number;
  /** Markup % (reseller), or the retail markup % for direct sales. */
  markupPercent: number;
  discountPercent: number;
  /** The buyer's price per MB (reseller price; direct sales: Yesim cost). */
  pricePerMb: number;
  /** What we pay Yesim. */
  cost: number;
  /** What the buyer's wallet is charged (unrounded). */
  amount: number;
  /** Our revenue: the reseller charge, or the retail price for direct sales. */
  revenue: number;
  /** Markup and discount in euros (for the waterfall). */
  markupAmount: number;
  discountAmount: number;
  estimated: boolean;
  version: number;
};

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ------------------------------------------------------------------ rates

/** The price list version in force on a day (versions sorted oldest first). */
export function versionAt(s: DState, date: string): DPriceVersion {
  let v = s.priceVersions[0]!;
  for (const x of s.priceVersions) if (x.effectiveFrom <= date) v = x;
  return v;
}

/** Yesim €/MB of a network on a day: today's price, undone through later versions that changed it. */
export function costAt(s: DState, networkId: string, date: string): number | null {
  let cost = NETWORK_BY_ID.get(networkId)?.costPerMb ?? null;
  if (cost === null) return null;
  for (let i = s.priceVersions.length - 1; i >= 0; i--) {
    const v = s.priceVersions[i]!;
    if (v.effectiveFrom <= date) break;
    const c = v.changes.find((x) => x.networkId === networkId);
    if (c) cost = c.oldCost;
  }
  return cost;
}

const ms = (iso: string) => Date.parse(iso);

/** Markup % in force at a moment (ms); before the first entry, the starting markup. */
export function markupAtTime(s: DState, resellerId: string, t: number): number {
  let m: number | null = null;
  let mAt = -Infinity;
  let first: number | null = null;
  let firstAt = Infinity;
  for (const h of s.markupHistory) {
    if (h.resellerId !== resellerId) continue;
    const at = ms(h.effectiveAt);
    if (at < firstAt) {
      firstAt = at;
      first = h.markupPercent;
    }
    if (at <= t && at >= mAt) {
      mAt = at;
      m = h.markupPercent;
    }
  }
  return m ?? first ?? s.resellers.find((r) => r.id === resellerId)?.markupPercent ?? s.settings.defaultMarkupPercent;
}

/** The retail markup for direct sales at a moment (history kept under the id "house"). */
export function retailAtTime(s: DState, t: number): number {
  let m: number | null = null;
  let mAt = -Infinity;
  for (const h of s.markupHistory)
    if (h.resellerId === "house" && ms(h.effectiveAt) <= t && ms(h.effectiveAt) >= mAt) {
      mAt = ms(h.effectiveAt);
      m = h.markupPercent;
    }
  return m ?? s.settings.retailMarkupPercent;
}

/** The most specific discount in force at a moment (reseller + plan over reseller only). */
export function discountAtTime(s: DState, resellerId: string, planId: string | null, t: number): number {
  const live = s.discounts.filter((d) => d.resellerId === resellerId && ms(d.effectiveAt) <= t && (!d.endedAt || t < ms(d.endedAt)));
  return ((planId ? live.find((d) => d.planId === planId) : undefined) ?? live.find((d) => d.planId === null))?.percent ?? 0;
}

/** A day's window in ms (Colombo): midnight to midnight, or to when the demo data was made for today. */
export function dayWindow(s: DState, date: string): [number, number] {
  const start = ms(`${date}T00:00:00+05:30`);
  const end = start + 86400000;
  return [start, date === s.seededOn ? Math.max(start + 60000, Math.min(end, ms(s.seededAt))) : end];
}

/** Markup at the end of a day (convenience for reports and tests). */
export function markupAt(s: DState, resellerId: string, date: string) {
  return markupAtTime(s, resellerId, dayWindow(s, date)[1] - 1);
}
export function discountAt(s: DState, resellerId: string, planId: string | null, date: string) {
  return discountAtTime(s, resellerId, planId, dayWindow(s, date)[1] - 1);
}

type Segment = { share: number; markup: number; discount: number };
/** A day's rate periods for one buyer: split where a markup, retail markup or discount change was saved. */
function segments(s: DState, owner: string | null, planId: string, date: string): Segment[] {
  const [start, end] = dayWindow(s, date);
  const cuts = new Set<number>();
  const within = (iso: string | null) => {
    if (!iso) return;
    const t = ms(iso);
    if (t > start && t < end) cuts.add(t);
  };
  for (const h of s.markupHistory) if (h.resellerId === (owner ?? "house")) within(h.effectiveAt);
  if (owner)
    for (const d of s.discounts)
      if (d.resellerId === owner) {
        within(d.effectiveAt);
        within(d.endedAt);
      }
  const points = [start, ...[...cuts].sort((a, b) => a - b), end];
  const out: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const t = points[i]!;
    const seg = {
      share: (points[i + 1]! - t) / (end - start),
      markup: owner === null ? retailAtTime(s, t) : markupAtTime(s, owner, t),
      discount: owner === null ? 0 : discountAtTime(s, owner, planId, t),
    };
    const last = out[out.length - 1];
    if (last && last.markup === seg.markup && last.discount === seg.discount) last.share += seg.share;
    else out.push(seg);
  }
  return out;
}

/** Estimated until the nightly report: the last two days, and late report days. */
export function isEstimated(s: DState, resellerId: string | null, date: string) {
  return date >= addDays(s.seededOn, -1) || (s.lateDays[resellerId ?? "house"] ?? []).includes(date);
}

// ------------------------------------------------------------------ lines

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/** Share of a day's data on the second network (0 on most days). */
function altShare(p: DPackage, dayIndex: number) {
  if (!p.altNetworkId) return 0;
  const h = hash(`${p.id}:${dayIndex}`);
  return h < 0.35 ? 0.2 + (h / 0.35) * 0.5 : 0;
}

export function packageOwner(s: DState, p: DPackage) {
  return s.esims.find((e) => e.id === p.esimId)?.resellerId ?? null;
}

/** The rated lines of one package on one day (index into its usage array). */
export function packageDayLines(s: DState, p: DPackage, dayIndex: number, owner: string | null = packageOwner(s, p)): RatedLine[] {
  const u = s.usage[p.id];
  const mbDay = u?.mb[dayIndex] ?? 0;
  if (!u || !mbDay) return [];
  const date = addDays(u.start, dayIndex);
  const share = altShare(p, dayIndex);
  const parts: [string, number][] = share > 0 ? [[p.networkId, 1 - share], [p.altNetworkId!, share]] : [[p.networkId, 1]];
  const estimated = isEstimated(s, owner, date);
  const version = versionAt(s, date).version;
  const direct = owner === null;
  const segs = segments(s, owner, p.planId, date);
  return parts.flatMap(([networkId, f]) => {
    const cost = costAt(s, networkId, date) ?? 0;
    return segs.map((seg) => {
      const mb = mbDay * f * seg.share;
      const resellerPrice = cost * (1 + seg.markup / 100) * (1 - seg.discount / 100);
      const pricePerMb = direct ? cost : resellerPrice;
      return {
        date,
        packageId: p.id,
        esimId: p.esimId,
        planId: p.planId,
        resellerId: owner,
        networkId,
        iso2: NETWORK_BY_ID.get(networkId)?.iso2 ?? "--",
        mb,
        costPerMb: cost,
        markupPercent: seg.markup,
        discountPercent: seg.discount,
        pricePerMb,
        cost: mb * cost,
        amount: mb * pricePerMb,
        revenue: mb * resellerPrice,
        markupAmount: mb * cost * (seg.markup / 100),
        discountAmount: mb * cost * (1 + seg.markup / 100) * (seg.discount / 100),
        estimated,
        version,
      };
    });
  });
}

/** A package's charge for a day: its network lines summed, rounded to cents once. */
export function dayCharge(lines: RatedLine[]) {
  return round2(lines.reduce((a, l) => a + l.amount, 0));
}

/** Walks every rated package-day (optionally only some packages / dates). */
export function forEachPackageDay(
  s: DState,
  fn: (p: DPackage, date: string, lines: RatedLine[], charge: number, owner: string | null) => void,
  filter: { packages?: (p: DPackage, owner: string | null) => boolean; from?: string; to?: string } = {},
) {
  for (const p of s.packages) {
    const u = s.usage[p.id];
    if (!u) continue;
    const owner = packageOwner(s, p);
    if (filter.packages && !filter.packages(p, owner)) continue;
    u.mb.forEach((mb, i) => {
      if (!mb) return;
      const date = addDays(u.start, i);
      if ((filter.from && date < filter.from) || (filter.to && date > filter.to)) return;
      const lines = packageDayLines(s, p, i, owner);
      fn(p, date, lines, dayCharge(lines), owner);
    });
  }
}

/** A package's total charges so far, split final / estimated (cents). */
export function packageCharges(s: DState, p: DPackage) {
  let final = 0;
  let estimated = 0;
  const u = s.usage[p.id];
  if (!u) return { final, estimated };
  const owner = packageOwner(s, p);
  u.mb.forEach((mb, i) => {
    if (!mb) return;
    const lines = packageDayLines(s, p, i, owner);
    const c = dayCharge(lines);
    if (lines[0]?.estimated) estimated += c;
    else final += c;
  });
  return { final: round2(final), estimated: round2(estimated) };
}
