/**
 * Demo pricing, using the backend formula (spec 2.1, CONVENTIONS §6):
 *
 *   reseller price per MB = supplier €/MB × (1 + markup) × (1 − discount)
 *
 * The most specific discount wins (reseller + plan over reseller only).
 * Direct sales are charged to the house wallet at supplier cost; the customer
 * price shown to admins uses the retail markup (Q-DIRECT). Unpriced networks
 * are never priced. Holds: plan data × the buyer's highest price among the
 * zone's networks, unless the plan has a hold override.
 */
import { isPriced, type Network } from "@/lib/platform/coverage";
import { BYTES } from "@/lib/platform/units";
import type { PriceRange } from "@/lib/platform/types";
import { zoneNetworks } from "./catalogue";
import type { DPlan, DState } from "./model";

/** Who is buying: a reseller (their markup and discount) or the house (direct sale, at cost). */
export type Buyer = { kind: "reseller"; resellerId: string } | { kind: "house" };

export function pricePerMb(cost: number, markupPercent: number, discountPercent: number): number {
  return cost * (1 + markupPercent / 100) * (1 - discountPercent / 100);
}

export function discountFor(s: DState, resellerId: string, planId: string | null): number {
  const active = s.discounts.filter((d) => d.status === "active" && d.resellerId === resellerId);
  const specific = planId ? active.find((d) => d.planId === planId) : undefined;
  return (specific ?? active.find((d) => d.planId === null))?.percent ?? 0;
}

export function markupFor(s: DState, resellerId: string): number {
  return s.resellers.find((r) => r.id === resellerId)?.markupPercent ?? s.settings.defaultMarkupPercent;
}

/** The buyer's price per MB on a network (null when the network has no price). */
export function buyerPricePerMb(s: DState, buyer: Buyer, network: Network, planId: string | null): number | null {
  if (!isPriced(network)) return null;
  if (buyer.kind === "house") return network.costPerMb!;
  return pricePerMb(network.costPerMb!, markupFor(s, buyer.resellerId), discountFor(s, buyer.resellerId, planId));
}

/** Customer price for direct sales (retail markup). */
export function retailPricePerMb(s: DState, network: Network): number | null {
  return isPriced(network) ? pricePerMb(network.costPerMb!, s.settings.retailMarkupPercent, 0) : null;
}

export function range(values: number[]): PriceRange | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  const typical = v.length % 2 ? v[mid]! : (v[mid - 1]! + v[mid]!) / 2;
  return { min: v[0]!, typical, max: v[v.length - 1]! };
}

/** Per-MB range of a plan for a buyer, over the zone's priced networks. */
export function planPerMbRange(s: DState, plan: DPlan, buyer: Buyer): PriceRange | null {
  return range(zoneNetworks(plan.zoneId).map((n) => buyerPricePerMb(s, buyer, n, plan.id)).filter((x): x is number => x !== null));
}

export function holdFor(s: DState, plan: DPlan, buyer: Buyer): number {
  if (plan.holdOverride !== null) return plan.holdOverride;
  const r = planPerMbRange(s, plan, buyer);
  return r ? round2((plan.dataBytes / BYTES.MB) * r.max) : 0;
}

export function zoneUsable(zoneId: string): boolean {
  const nets = zoneNetworks(zoneId);
  return nets.length > 0 && nets.every(isPriced);
}

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
