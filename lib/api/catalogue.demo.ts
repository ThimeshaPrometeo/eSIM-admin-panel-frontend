/**
 * Demo catalogue: coverage, price list, plans, the sellable catalogue,
 * reseller plans and discounts. Prices use the backend formula and the
 * viewer's own prices (resellers never see supplier cost or markups).
 */
import { ApiError } from "./errors";
import { CATALOGUE, NETWORK_BY_ID, ZONE_BY_ID, zoneNetworks } from "@/lib/demo/catalogue";
import type { DPlan, DState } from "@/lib/demo/model";
import { buyerPricePerMb, discountFor, holdFor, markupFor, planPerMbRange, pricePerMb, range, retailPricePerMb, zoneUsable, type Buyer } from "@/lib/demo/pricing";
import { read, write } from "@/lib/demo/run";
import { audit, authorize, nowIso, requireRole, type Caller } from "@/lib/demo/session";
import { isCountry, isPriced, type Network } from "@/lib/platform/coverage";
import { money } from "@/lib/platform/money";
import { priceListSyncedAt } from "@/lib/demo/supplier";
import { BYTES } from "@/lib/platform/units";
import type {
  CatalogueItem,
  CoverageCountry,
  CoverageCountryDetail,
  Discount,
  Plan,
  PlanDetail,
  PlanPricingPreview,
  PriceList,
  PricedNetwork,
  ResellerPlan,
  Zone,
} from "@/lib/platform/types";

/** Reseller side: own prices. Tenant: supplier cost (direct sales are charged at cost). */
export function viewerBuyer(c: Caller): Buyer {
  return c.resellerId ? { kind: "reseller", resellerId: c.resellerId } : { kind: "house" };
}

function priced(c: Caller, n: Network, planId: string | null = null): PricedNetwork {
  return {
    id: n.id,
    iso2: n.iso2,
    country: n.country,
    operator: n.operator,
    tadigs: n.tadigs,
    mccMnc: n.mccMnc,
    lte: n.lte,
    nr: n.nr,
    volte: n.volte,
    pricePerMb: buyerPricePerMb(c.s, viewerBuyer(c), n, planId),
    ...(c.tenant ? { costPerMb: n.costPerMb } : {}),
  };
}

export function zoneView(z: (typeof CATALOGUE.zones)[number]): Zone {
  const nets = zoneNetworks(z.id);
  return {
    id: z.id,
    name: z.name,
    source: z.source,
    demoZone: z.demoZone,
    networkCount: nets.length,
    countryCount: new Set(nets.filter((n) => isCountry(n.iso2)).map((n) => n.iso2)).size,
    unpricedNetworks: nets.filter((n) => !isPriced(n)).length,
    usable: zoneUsable(z.id),
  };
}

function soldCount(s: DState, planId: string) {
  return s.orders.filter((o) => o.planId === planId && (o.status === "completed" || o.status === "awaiting_funds")).length;
}

export function planView(s: DState, p: DPlan): Plan {
  const zone = ZONE_BY_ID.get(p.zoneId)!;
  const nets = zoneNetworks(p.zoneId);
  const cost = range(nets.filter(isPriced).map((n) => n.costPerMb!));
  const defaultBuyerHold = p.holdOverride ?? (cost ? (p.dataBytes / BYTES.MB) * cost.max * (1 + s.settings.defaultMarkupPercent / 100) : 0);
  return {
    id: p.id,
    name: p.name,
    zoneId: p.zoneId,
    zoneName: zone.name,
    demoZone: zone.demoZone,
    dataBytes: p.dataBytes,
    validityDays: p.validityDays,
    status: p.status,
    holdOverride: p.holdOverride === null ? null : money(p.holdOverride),
    defaultHold: money(defaultBuyerHold),
    countryCount: new Set(nets.filter((n) => isCountry(n.iso2)).map((n) => n.iso2)).size,
    networkCount: nets.length,
    costPerMb: cost,
    spreadRatio: cost ? cost.max / cost.min : null,
    soldCount: soldCount(s, p.id),
    createdAt: p.createdAt,
  };
}

/** A plan as one buyer sells it, in their prices. */
export function catalogueItem(s: DState, p: DPlan, buyer: Buyer, rp?: DState["resellerPlans"][number]): CatalogueItem {
  const r = planPerMbRange(s, p, buyer) ?? { min: 0, typical: 0, max: 0 };
  const mb = p.dataBytes / BYTES.MB;
  const nets = zoneNetworks(p.zoneId);
  return {
    planId: p.id,
    resellerPlanId: rp?.id ?? null,
    name: rp?.name ?? p.name,
    basePlanName: p.name,
    zoneName: ZONE_BY_ID.get(p.zoneId)!.name,
    dataBytes: p.dataBytes,
    validityDays: p.validityDays,
    countries: [...new Set(nets.filter((n) => isPriced(n) && isCountry(n.iso2)).map((n) => n.iso2))].sort(),
    perGb: { min: r.min * 1024, typical: r.typical * 1024, max: r.max * 1024 },
    total: { min: money(r.min * mb), typical: money(r.typical * mb), max: money(r.max * mb) },
    hold: money(holdFor(s, p, buyer)),
    sellingPrice: rp ? money(rp.sellingPrice) : null,
  };
}

function previewFor(s: DState, zoneId: string, dataBytes: number, holdOverride: number | null): PlanPricingPreview {
  const nets = zoneNetworks(zoneId);
  const pricedNets = nets.filter(isPriced);
  const cost = range(pricedNets.map((n) => n.costPerMb!));
  const mb = dataBytes / BYTES.MB;
  const activeResellers = s.resellers.filter((r) => r.status === "active");
  const holds = cost ? activeResellers.map((r) => mb * cost.max * (1 + r.markupPercent / 100) * (1 - discountFor(s, r.id, null) / 100)) : [];
  return {
    zoneId,
    networks: nets.map((n) => ({
      id: n.id,
      iso2: n.iso2,
      country: n.country,
      operator: n.operator,
      tadigs: n.tadigs,
      mccMnc: n.mccMnc,
      lte: n.lte,
      nr: n.nr,
      volte: n.volte,
      pricePerMb: n.costPerMb,
      costPerMb: n.costPerMb,
    })),
    unpriced: nets.length - pricedNets.length,
    costPerMb: cost,
    spreadRatio: cost ? cost.max / cost.min : null,
    spreadWarning: !!cost && cost.max / cost.min > s.settings.spreadWarningRatio,
    spreadThreshold: s.settings.spreadWarningRatio,
    defaultHold: holdOverride !== null ? money(holdOverride) : cost ? money(mb * cost.max * (1 + s.settings.defaultMarkupPercent / 100)) : null,
    holdRange: holdOverride !== null ? { min: money(holdOverride), max: money(holdOverride) } : holds.length ? { min: money(Math.min(...holds)), max: money(Math.max(...holds)) } : null,
  };
}

export type PlanInput = { name: string; zoneId: string; dataBytes: number; validityDays: number; holdOverride: number | null; status: Plan["status"] };
export type ResellerPlanInput = { planId: string; name: string; description: string; sellingPrice: number };
export type DiscountInput = { resellerId: string; planId: string | null; percent: number };


function newDiscount(c: Caller, resellerId: string, planId: string | null, percent: number): DState["discounts"][number] {
  return { id: `d${++c.s.seq}`, resellerId, planId, percent, status: "active", createdAt: nowIso(), effectiveAt: nowIso(), endedAt: null, createdBy: c.u.id };
}

export const demoCatalogue = {
  // -------------------------------------------------------------- coverage
  listCoverageCountries: (filters: { q?: string; zoneId?: string | null; planId?: string | null; tech?: "4g" | "5g" | null } = {}) =>
    read((): CoverageCountry[] => {
      const c = authorize("coverage");
      const sellable = c.s.plans.filter((p) => p.status === "active");
      let nets = CATALOGUE.networks.filter((n) => isCountry(n.iso2));
      if (filters.zoneId) nets = nets.filter((n) => ZONE_BY_ID.get(filters.zoneId!)?.networkIds.includes(n.id));
      if (filters.planId) {
        const plan = c.s.plans.find((p) => p.id === filters.planId);
        nets = plan ? nets.filter((n) => ZONE_BY_ID.get(plan.zoneId)?.networkIds.includes(n.id)) : [];
      }
      const by = new Map<string, Network[]>();
      for (const n of nets) by.set(n.iso2, [...(by.get(n.iso2) ?? []), n]);
      const q = filters.q?.trim().toLowerCase();
      return [...by.entries()]
        .map(([iso2, list]) => {
          const prices = list.map((n) => buyerPricePerMb(c.s, viewerBuyer(c), n, null)).filter((x): x is number => x !== null);
          return {
            iso2,
            name: list[0]!.country,
            networkCount: list.length,
            pricedCount: list.filter(isPriced).length,
            lte: list.some((n) => n.lte),
            nr: list.some((n) => n.nr),
            planCount: sellable.filter((p) => zoneNetworks(p.zoneId).some((n) => n.iso2 === iso2 && isPriced(n))).length,
            fromPerMb: prices.length ? Math.min(...prices) : null,
          };
        })
        .filter((x) => !q || x.name.toLowerCase().includes(q) || x.iso2.toLowerCase() === q)
        .filter((x) => filters.tech !== "5g" || x.nr)
        .filter((x) => filters.tech !== "4g" || x.lte)
        .sort((a, b) => a.name.localeCompare(b.name));
    }),
  getCoverageCountry: (iso2: string) =>
    read((): CoverageCountryDetail => {
      const c = authorize("coverage");
      const nets = CATALOGUE.networks.filter((n) => n.iso2 === iso2);
      if (!nets.length) throw new ApiError(404, "NOT_FOUND");
      const zones = CATALOGUE.zones.filter((z) => nets.some((n) => z.networkIds.includes(n.id)));
      const plans = c.s.plans
        .filter((p) => p.status === "active" && zoneNetworks(p.zoneId).some((n) => n.iso2 === iso2 && isPriced(n)))
        .map((p) => ({ id: p.id, name: p.name, dataBytes: p.dataBytes, validityDays: p.validityDays, zoneName: ZONE_BY_ID.get(p.zoneId)!.name }));
      return {
        iso2,
        name: nets[0]!.country,
        networks: nets.map((n) => priced(c, n)).sort((a, b) => (a.pricePerMb ?? Infinity) - (b.pricePerMb ?? Infinity)),
        plans,
        zones: zones.map((z) => ({ id: z.id, name: z.name, demoZone: z.demoZone, usable: zoneUsable(z.id) })),
        priceBasis: c.tenant ? "cost" : "own",
      };
    }),
  listZones: () => read((): Zone[] => (authorize(["coverage", "plans"]), CATALOGUE.zones.map(zoneView))),

  // ------------------------------------------------------------ price list
  getCurrentPriceList: (opts: { resellerId?: string | null } = {}) =>
    read((): PriceList => {
      const c = authorize("price_lists");
      const pickR = c.tenant && opts.resellerId ? c.s.resellers.find((r) => r.id === opts.resellerId) : null;
      const zonesOf = (id: string) => CATALOGUE.zones.filter((z) => z.networkIds.includes(id)).map((z) => z.name);
      const rows = CATALOGUE.networks.map((n) => ({
        ...priced(c, n),
        zones: zonesOf(n.id),
        ...(c.tenant
          ? {
              retailPricePerMb: retailPricePerMb(c.s, n),
              resellerPricePerMb: pickR ? buyerPricePerMb(c.s, { kind: "reseller", resellerId: pickR.id }, n, null) : undefined,
            }
          : {}),
      }));
      return {
        rows: rows.sort((a, b) => a.country.localeCompare(b.country) || a.operator.localeCompare(b.operator)),
        syncedAt: priceListSyncedAt(c.s),
        version: c.s.priceVersions[c.s.priceVersions.length - 1]!.version,
        basis: c.tenant ? "cost" : "own",
        resellerName: pickR?.companyName ?? null,
      };
    }),
  /** Admin: runs the price list sync now. Demo: prices are unchanged. */
  syncPriceList: () =>
    write(() => {
      const c = authorize("price_lists", "manage");
      requireRole(c, "admin");
      const at = new Date().toISOString();
      c.s.jobRuns.price_list_sync = at;
      audit(c, "price_list.synced", "price_list", "current", "Price list sync: no changes", null);
      return { status: "unchanged" as const, at };
    }),

  // ----------------------------------------------------------------- plans
  listPlans: (filters: { q?: string; status?: Plan["status"] | null; zoneId?: string | null } = {}) =>
    read((): Plan[] => {
      const c = authorize("plans");
      const q = filters.q?.trim().toLowerCase();
      return c.s.plans
        .filter((p) => (!filters.status || p.status === filters.status) && (!filters.zoneId || p.zoneId === filters.zoneId) && (!q || p.name.toLowerCase().includes(q)))
        .map((p) => planView(c.s, p));
    }),
  getPlan: (id: string) =>
    read((): PlanDetail => {
      const c = authorize("plans");
      const p = c.s.plans.find((x) => x.id === id);
      if (!p) throw new ApiError(404, "NOT_FOUND");
      const examples = c.s.resellers.filter((r) => r.status === "active").slice(0, 3);
      const nets = zoneNetworks(p.zoneId);
      return {
        ...planView(c.s, p),
        networks: nets
          .map((n) => ({
            ...priced(c, n, p.id),
            costPerMb: n.costPerMb,
            examples: examples.map((r) => ({ resellerName: r.companyName, pricePerMb: buyerPricePerMb(c.s, { kind: "reseller", resellerId: r.id }, n, p.id) })),
          }))
          .sort((a, b) => (a.costPerMb ?? Infinity) - (b.costPerMb ?? Infinity)),
        countries: [...new Set(nets.filter((n) => isCountry(n.iso2)).map((n) => n.iso2))].sort(),
        resellerPlans: c.s.resellerPlans.filter((rp) => rp.planId === p.id && rp.status === "active").length,
      };
    }),
  pricingPreview: (input: { zoneId: string; dataBytes: number; holdOverride: number | null }) =>
    read((): PlanPricingPreview => {
      const c = authorize("plans");
      return previewFor(c.s, input.zoneId, input.dataBytes, input.holdOverride);
    }),
  createPlan: (input: PlanInput) =>
    write((): Plan => {
      const c = authorize("plans", "manage");
      requireRole(c, "admin");
      if (!zoneUsable(input.zoneId)) throw new ApiError(409, "ZONE_HAS_UNPRICED_NETWORKS");
      const p: DPlan = { id: `p${++c.s.seq}`, ...input, name: input.name.trim(), createdAt: new Date().toISOString() };
      c.s.plans.unshift(p);
      audit(c, "plan.created", "plan", p.id, `Plan ${p.name} created`, null);
      return planView(c.s, p);
    }),
  updatePlan: (id: string, input: PlanInput) =>
    write((): Plan => {
      const c = authorize("plans", "manage");
      requireRole(c, "admin");
      const p = c.s.plans.find((x) => x.id === id);
      if (!p) throw new ApiError(404, "NOT_FOUND");
      if (input.status === "active" && !zoneUsable(input.zoneId)) throw new ApiError(409, "ZONE_HAS_UNPRICED_NETWORKS");
      Object.assign(p, { ...input, name: input.name.trim() });
      audit(c, "plan.updated", "plan", p.id, `Plan ${p.name} updated`, null);
      return planView(c.s, p);
    }),

  // ------------------------------------------------------- sellable catalogue
  /** Sellable plans in the viewer's prices (`GET /plans/catalogue`), plus resellers' own named plans. */
  listPlansCatalogue: (filters: { q?: string; country?: string | null } = {}) =>
    read((): CatalogueItem[] => {
      const c = authorize(["sell_esim", "reseller_plans", "plans"]);
      const buyer = viewerBuyer(c);
      const q = filters.q?.trim().toLowerCase();
      const plans = c.s.plans.filter((p) => p.status === "active");
      const items = plans.map((p) => catalogueItem(c.s, p, buyer));
      const own = c.resellerId
        ? c.s.resellerPlans
            .filter((rp) => rp.resellerId === c.resellerId && rp.status === "active")
            .map((rp) => {
              const p = plans.find((x) => x.id === rp.planId);
              return p ? catalogueItem(c.s, p, buyer, rp) : null;
            })
            .filter((x): x is CatalogueItem => !!x)
        : [];
      return [...own, ...items].filter(
        (i) =>
          (!q || i.name.toLowerCase().includes(q) || i.zoneName.toLowerCase().includes(q) || i.countries.some((iso) => CATALOGUE.networks.find((n) => n.iso2 === iso)?.country.toLowerCase().includes(q))) &&
          (!filters.country || i.countries.includes(filters.country)),
      );
    }),

  // -------------------------------------------------------- reseller plans
  listResellerPlans: () =>
    read((): ResellerPlan[] => {
      const c = authorize("reseller_plans");
      return c.s.resellerPlans
        .filter((rp) => c.tenant || rp.resellerId === c.resellerId)
        .map((rp) => {
          const p = c.s.plans.find((x) => x.id === rp.planId)!;
          return {
            id: rp.id,
            planId: rp.planId,
            planName: p.name,
            name: rp.name,
            description: rp.description,
            sellingPrice: money(rp.sellingPrice),
            status: rp.status,
            resellerId: rp.resellerId,
            resellerName: c.s.resellers.find((r) => r.id === rp.resellerId)?.companyName ?? "",
            dataBytes: p.dataBytes,
            validityDays: p.validityDays,
            zoneName: ZONE_BY_ID.get(p.zoneId)!.name,
            createdAt: rp.createdAt,
          };
        })
        .sort((a, b) => (a.status === b.status ? b.createdAt.localeCompare(a.createdAt) : a.status === "active" ? -1 : 1));
    }),
  createResellerPlan: (input: ResellerPlanInput) =>
    write(() => {
      const c = authorize("reseller_plans", "manage");
      requireRole(c, "reseller", "assistant");
      const base = c.s.plans.find((p) => p.id === input.planId && p.status === "active");
      if (!base) throw new ApiError(409, "PLAN_NOT_ACTIVE", "Pick an active plan.");
      const rp = { id: `rp${++c.s.seq}`, resellerId: c.resellerId!, planId: input.planId, name: input.name.trim(), description: input.description.trim(), sellingPrice: input.sellingPrice, status: "active" as const, createdAt: new Date().toISOString() };
      c.s.resellerPlans.unshift(rp);
      return rp.id;
    }),
  updateResellerPlan: (id: string, input: ResellerPlanInput & { status?: "active" | "inactive" }) =>
    write(() => {
      const c = authorize("reseller_plans", "manage");
      requireRole(c, "reseller", "assistant");
      const rp = c.s.resellerPlans.find((x) => x.id === id && x.resellerId === c.resellerId);
      if (!rp) throw new ApiError(404, "NOT_FOUND");
      Object.assign(rp, { planId: input.planId, name: input.name.trim(), description: input.description.trim(), sellingPrice: input.sellingPrice, status: input.status ?? rp.status });
    }),
  deleteResellerPlan: (id: string) =>
    write(() => {
      const c = authorize("reseller_plans", "manage");
      requireRole(c, "reseller", "assistant");
      const rp = c.s.resellerPlans.find((x) => x.id === id && x.resellerId === c.resellerId);
      if (!rp) throw new ApiError(404, "NOT_FOUND");
      rp.status = "inactive";
    }),

  // ------------------------------------------------------------- discounts
  listDiscounts: () =>
    read((): Discount[] => {
      const c = authorize("discounts");
      return c.s.discounts
        .filter((d) => d.status === "active" && (c.tenant || d.resellerId === c.resellerId))
        .map((d) => ({
          id: d.id,
          resellerId: d.resellerId,
          resellerName: c.s.resellers.find((r) => r.id === d.resellerId)?.companyName ?? "",
          planId: d.planId,
          planName: d.planId ? (c.s.plans.find((p) => p.id === d.planId)?.name ?? null) : null,
          percent: d.percent,
          status: d.status,
          createdAt: d.createdAt,
        }))
        .sort((a, b) => a.resellerName.localeCompare(b.resellerName) || (a.planName ?? "").localeCompare(b.planName ?? ""));
    }),
  // Discount changes apply to usage from the moment they're saved; history is kept.
  createDiscount: (input: DiscountInput) =>
    write(() => {
      const c = authorize("discounts", "manage");
      requireRole(c, "admin");
      if (c.s.discounts.some((d) => d.status === "active" && d.resellerId === input.resellerId && d.planId === input.planId)) throw new ApiError(409, "DUPLICATE_DISCOUNT");
      const d = newDiscount(c, input.resellerId, input.planId, input.percent);
      c.s.discounts.push(d);
      audit(c, "discount.created", "discount", d.id, `Discount ${input.percent}%${input.planId ? ` on ${c.s.plans.find((p) => p.id === input.planId)?.name}` : ""}`, input.resellerId);
    }),
  updateDiscount: (id: string, input: { percent: number }) =>
    write(() => {
      const c = authorize("discounts", "manage");
      requireRole(c, "admin");
      const d = c.s.discounts.find((x) => x.id === id && x.status === "active");
      if (!d) throw new ApiError(404, "NOT_FOUND");
      audit(c, "discount.updated", "discount", d.id, `Discount changed from ${d.percent}% to ${input.percent}%`, d.resellerId);
      d.status = "inactive";
      d.endedAt = nowIso();
      c.s.discounts.push(newDiscount(c, d.resellerId, d.planId, input.percent));
    }),
  deleteDiscount: (id: string) =>
    write(() => {
      const c = authorize("discounts", "manage");
      requireRole(c, "admin");
      const d = c.s.discounts.find((x) => x.id === id && x.status === "active");
      if (!d) throw new ApiError(404, "NOT_FOUND");
      d.status = "inactive";
      d.endedAt = nowIso();
      audit(c, "discount.removed", "discount", d.id, `Discount ${d.percent}% removed`, d.resellerId);
    }),
  /**
   * Live preview for the discount form: the reseller's price per GB on a
   * sample network of the plan's zone (or Italy), before and after.
   */
  discountPreview: (input: { resellerId: string; planId: string | null; percent: number }) =>
    read(() => {
      const c = authorize("discounts");
      const plan = input.planId ? c.s.plans.find((p) => p.id === input.planId) : null;
      const nets = (plan ? zoneNetworks(plan.zoneId) : zoneNetworks("lz79313")).filter(isPriced);
      const sample = [...nets].sort((a, b) => a.costPerMb! - b.costPerMb!)[Math.floor(nets.length / 2)]!;
      const markup = markupFor(c.s, input.resellerId);
      const current = discountFor(c.s, input.resellerId, input.planId);
      return {
        network: `${sample.operator} (${sample.country})`,
        beforePerGb: pricePerMb(sample.costPerMb!, markup, current) * 1024,
        afterPerGb: pricePerMb(sample.costPerMb!, markup, input.percent) * 1024,
        currentPercent: current,
      };
    }),
};

export type CatalogueApi = typeof demoCatalogue;
export { NETWORK_BY_ID };
