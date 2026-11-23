/**
 * Demo finance (spec 8.32): price breakdown, simulator, charge breakdown,
 * profit report, price and markup history, invoices and statements,
 * settings. Every figure comes from lib/demo/rating (rated usage lines) or
 * from today's rates through the same formula:
 *
 *   reseller price per MB = Yesim €/MB × (1 + markup) × (1 − discount)
 */
import { ApiError } from "./errors";
import { CATALOGUE, NETWORK_BY_ID } from "@/lib/demo/catalogue";
import type { DState } from "@/lib/demo/model";
import { discountFor } from "@/lib/demo/pricing";
import { forEachPackageDay, round2, type RatedLine } from "@/lib/demo/rating";
import { read, write } from "@/lib/demo/run";
import { priceListSyncedAt, supplierBalance } from "@/lib/demo/supplier";
import { audit, authorize, requireRole, type Caller } from "@/lib/demo/session";
import { isCountry, isPriced } from "@/lib/platform/coverage";
import { addDays, dateInZone, formatDate } from "@/lib/platform/dates";
import { money } from "@/lib/platform/money";
import { bucketOf, bucketsIn, type Period } from "@/lib/platform/period";
import type {
  ChargeBreakdown,
  ChargeLine,
  InvoiceDetail,
  InvoiceKind,
  InvoiceSummary,
  MarkupChange,
  PriceBreakdown,
  PriceChange,
  PriceVersion,
  ProfitReport,
  ProfitRow,
  Simulation,
  TenantSettings,
} from "@/lib/platform/types";

const MB = 1048576;

const resellerName = (s: DState, id: string | null) => (id ? (s.resellers.find((r) => r.id === id)?.companyName ?? id) : "Direct sales");
const planName = (s: DState, id: string) => s.plans.find((p) => p.id === id)?.name ?? "";
const userName = (s: DState, id: string | null) => (id ? (s.users.find((u) => u.id === id)?.fullName ?? "System") : "System");

/** Today's chain for one reseller on one network (reseller-wide discount). */
function cell(s: DState, resellerId: string, cost: number | null) {
  const r = s.resellers.find((x) => x.id === resellerId)!;
  const markup = r.markupPercent;
  const discount = discountFor(s, resellerId, null);
  if (cost === null)
    return { resellerId, resellerName: r.companyName, markupPercent: markup, discountPercent: discount, pricePerMb: null, profitPerGb: null, marginPercent: null };
  const price = cost * (1 + markup / 100) * (1 - discount / 100);
  return {
    resellerId,
    resellerName: r.companyName,
    markupPercent: markup,
    discountPercent: discount,
    pricePerMb: price,
    profitPerGb: (price - cost) * 1024,
    marginPercent: price > 0 ? ((price - cost) / price) * 100 : 0,
  };
}

function profitRow(key: string, label: string, acc: { mb: number; revenue: number; cost: number }): ProfitRow {
  const profit = acc.revenue - acc.cost;
  return { key, label, mb: acc.mb, revenue: round2(acc.revenue), cost: round2(acc.cost), profit: round2(profit), marginPercent: acc.revenue > 0 ? (profit / acc.revenue) * 100 : 0 };
}

/** Statement months: the three full months before the demo's current month. */
function statementMonths(s: DState) {
  const out: string[] = [];
  const d = new Date(`${s.seededOn.slice(0, 7)}-01T00:00:00Z`);
  for (let i = 1; i <= 3; i++) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    out.push(m.toISOString().slice(0, 7));
  }
  return out;
}

function monthLabel(m: string) {
  return new Date(`${m}-01T00:00:00Z`).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

function monthEnd(m: string) {
  const d = new Date(`${m}-01T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

/** Every document, numbered sequentially per type and year in issue order (issued documents never change). */
function allInvoices(s: DState): InvoiceSummary[] {
  const docs: Omit<InvoiceSummary, "number">[] = [];
  for (const m of statementMonths(s)) {
    for (const r of s.resellers) {
      const usage = s.ledger.filter((l) => l.walletId === `w-${r.id}` && l.type === "usage_charge" && l.reference.slice(3, 10) === m).reduce((a, l) => a - l.amount, 0);
      if (usage <= 0 && !s.topups.some((t) => t.resellerId === r.id && t.status === "approved" && t.decidedAt?.slice(0, 7) === m)) continue;
      const issued = addDays(monthEnd(m), 1);
      docs.push({ id: `st-${r.id}-${m}`, kind: "statement", title: `Statement, ${monthLabel(m)}`, resellerId: r.id, resellerName: r.companyName, period: m, amount: money(usage), issuedAt: `${issued}T03:00:00.000Z` });
    }
  }
  for (const t of s.topups.filter((x) => x.status === "approved" && x.receiptNumber))
    docs.push({ id: `rc-${t.id}`, kind: "receipt", title: "Top-up receipt", resellerId: t.resellerId, resellerName: resellerName(s, t.resellerId), period: null, amount: money(t.amount), issuedAt: t.decidedAt! });
  for (const o of s.orders.filter((x) => x.resellerId === null && x.status === "completed" && x.retailAmount))
    docs.push({ id: `inv-${o.id}`, kind: "invoice", title: `Direct sale, ${planName(s, o.planId)}`, resellerId: null, resellerName: null, period: null, amount: money(o.retailAmount!), issuedAt: o.createdAt });
  docs.sort((a, b) => a.issuedAt.localeCompare(b.issuedAt) || a.id.localeCompare(b.id));
  const seq = new Map<string, number>();
  const prefix: Record<InvoiceKind, string> = { statement: "ST", receipt: "RC", invoice: "INV" };
  return docs
    .map((d) => {
      const year = d.issuedAt.slice(0, 4);
      const k = `${d.kind}-${year}`;
      seq.set(k, (seq.get(k) ?? 0) + 1);
      // receipts keep the number printed when the top-up was approved
      const receipt = d.kind === "receipt" ? s.topups.find((t) => `rc-${t.id}` === d.id)?.receiptNumber : null;
      return { ...d, number: receipt ?? `${prefix[d.kind]}-${year}-${String(seq.get(k)).padStart(4, "0")}` };
    })
    .reverse();
}

function chargeLine(s: DState, l: RatedLine, tenant: boolean, iccid: string): ChargeLine {
  const n = NETWORK_BY_ID.get(l.networkId)!;
  return {
    date: l.date,
    networkId: l.networkId,
    operator: n.operator,
    iso2: n.iso2,
    country: n.country,
    planName: planName(s, l.planId),
    iccid,
    mb: l.mb,
    costPerMb: tenant ? l.costPerMb : null,
    cost: tenant ? l.cost : null,
    // direct sales: the retail markup over Yesim cost (the house wallet itself pays cost)
    markupPercent: tenant ? l.markupPercent : null,
    discountPercent: tenant ? l.discountPercent : null,
    pricePerMb: l.pricePerMb,
    charge: l.amount,
    revenue: tenant ? l.revenue : null,
    profit: tenant ? l.revenue - l.cost : null,
    estimated: l.estimated,
    version: l.version,
  };
}

export type SimulateInput = { resellerId: string | "direct"; iso2?: string | null; networkId?: string | null; bytes: number };
export type ChargeQuery = { packageId: string; date?: string | null } | { walletId: string; date: string };

const SETTING_LABEL: Record<string, string> = {
  defaultMarkupPercent: "Default markup (%)",
  retailMarkupPercent: "Retail markup (%)",
  spreadWarningRatio: "Price spread warning (×)",
  waitingPlanCancelDays: "Cancel unfunded plans after (days)",
  houseWalletLowThreshold: "House wallet warning (€)",
  lowWalletThreshold: "Low wallet warning (€)",
  lowStockThreshold: "Low stock warning (eSIMs)",
  watermark: "PDF watermark",
  taxWording: "Tax wording",
};

export const demoFinance = {
  /** Admin/staff price breakdown for one to three resellers (today's rates). */
  getPriceBreakdown: (resellerIds: string[]) =>
    read((): PriceBreakdown => {
      const c = authorize("price_lists");
      if (!c.tenant) throw new ApiError(403, "FORBIDDEN");
      const ids = resellerIds.filter((id) => c.s.resellers.some((r) => r.id === id)).slice(0, 3);
      const v = c.s.priceVersions[c.s.priceVersions.length - 1]!;
      return {
        version: v.version,
        syncedAt: priceListSyncedAt(c.s),
        resellers: ids.map((id) => {
          const r = c.s.resellers.find((x) => x.id === id)!;
          return { id, name: r.companyName, markupPercent: r.markupPercent, discountPercent: discountFor(c.s, id, null) };
        }),
        rows: CATALOGUE.networks
          .filter((n) => isCountry(n.iso2))
          .map((n) => ({
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
            cells: ids.map((id) => cell(c.s, id, n.costPerMb)),
          }))
          .sort((a, b) => a.country.localeCompare(b.country) || a.operator.localeCompare(b.operator)),
      };
    }),

  /** Pricing simulator (admin): a reseller (or direct), a country or network, an amount of data. */
  simulate: (input: SimulateInput) =>
    read((): Simulation => {
      const c = authorize("price_lists");
      if (!c.tenant) throw new ApiError(403, "FORBIDDEN");
      const direct = input.resellerId === "direct";
      const nets = CATALOGUE.networks.filter((n) => isPriced(n) && (input.networkId ? n.id === input.networkId : n.iso2 === input.iso2));
      const mb = input.bytes / MB;
      return {
        buyer: direct ? "Direct sale (retail price)" : resellerName(c.s, input.resellerId),
        direct,
        bytes: input.bytes,
        lines: nets
          .map((n) => {
            const markup = direct ? c.s.settings.retailMarkupPercent : c.s.resellers.find((r) => r.id === input.resellerId)!.markupPercent;
            const discount = direct ? 0 : discountFor(c.s, input.resellerId, null);
            const cost = mb * n.costPerMb!;
            const beforeDiscount = cost * (1 + markup / 100);
            const price = beforeDiscount * (1 - discount / 100);
            return {
              networkId: n.id,
              operator: n.operator,
              iso2: n.iso2,
              country: n.country,
              mb,
              costPerMb: n.costPerMb!,
              markupPercent: markup,
              discountPercent: discount,
              cost,
              beforeDiscount,
              discountAmount: beforeDiscount - price,
              price,
              profit: price - cost,
              marginPercent: price > 0 ? ((price - cost) / price) * 100 : 0,
            };
          })
          .sort((a, b) => a.price - b.price),
      };
    }),

  /** "How was this charged?" for one plan (optionally one day), or one wallet's usage charge on a day. */
  getChargeBreakdown: (q: ChargeQuery) =>
    read((): ChargeBreakdown => {
      const c = authorize(["usage", "esims", "transactions", "invoices"]);
      const tenant = c.tenant;
      const lines: ChargeLine[] = [];
      let total = 0;
      let title = "";
      let subtitle = "";
      let direct = false;
      if ("packageId" in q) {
        const p = c.s.packages.find((x) => x.id === q.packageId);
        const e = p ? c.s.esims.find((x) => x.id === p.esimId) : null;
        if (!p || !e || (!tenant && e.resellerId !== c.resellerId)) throw new ApiError(404, "NOT_FOUND");
        direct = e.resellerId === null;
        forEachPackageDay(
          c.s,
          (_p, _d, ls, charge) => {
            total += charge;
            ls.forEach((l) => lines.push(chargeLine(c.s, l, tenant, e.iccid)));
          },
          { packages: (x) => x.id === p.id, from: q.date ?? undefined, to: q.date ?? undefined },
        );
        title = q.date ? `${p.name} on ${formatDate(`${q.date}T12:00:00Z`)}` : `${p.name}: all charges`;
        subtitle = `eSIM ${e.iccid} · ${resellerName(c.s, e.resellerId)}`;
      } else {
        const w = c.s.wallets.find((x) => x.id === q.walletId);
        if (!w || (!tenant && w.resellerId !== c.resellerId)) throw new ApiError(404, "NOT_FOUND");
        direct = w.resellerId === null;
        const iccid = new Map(c.s.esims.map((e) => [e.id, e.iccid]));
        forEachPackageDay(
          c.s,
          (p, _d, ls, charge) => {
            total += charge;
            ls.forEach((l) => lines.push(chargeLine(c.s, l, tenant, iccid.get(p.esimId) ?? "")));
          },
          { packages: (_p, owner) => owner === w.resellerId, from: q.date, to: q.date },
        );
        title = `Usage charges on ${formatDate(`${q.date}T12:00:00Z`)}`;
        subtitle = `${resellerName(c.s, w.resellerId)} · ${lines.length} network line${lines.length === 1 ? "" : "s"}`;
      }
      lines.sort((a, b) => b.date.localeCompare(a.date) || b.charge - a.charge);
      return {
        title,
        subtitle,
        lines,
        total: round2(total),
        totalCost: tenant ? lines.reduce((a, l) => a + (l.cost ?? 0), 0) : null,
        totalRevenue: tenant ? lines.reduce((a, l) => a + (l.revenue ?? 0), 0) : null,
        totalProfit: tenant ? lines.reduce((a, l) => a + (l.profit ?? 0), 0) : null,
        direct,
        estimated: lines.some((l) => l.estimated),
        viewer: tenant ? "tenant" : "reseller",
      };
    }),

  /** Profit and costs (spec 8.23): revenue, Yesim cost, profit, waterfall, breakdowns, reconciliation. */
  getProfitReport: (period: Pick<Period, "from" | "to" | "granularity">, opts: { resellerId?: string | null } = {}) =>
    read((): ProfitReport => {
      const c = authorize("profit_reports");
      const s = c.s;
      const buckets = bucketsIn(period);
      const series = new Map(buckets.map((b) => [b, { revenue: 0, cost: 0 }]));
      const acc = () => ({ mb: 0, revenue: 0, cost: 0 });
      const byR = new Map<string, ReturnType<typeof acc>>();
      const byC = new Map<string, ReturnType<typeof acc>>();
      const byN = new Map<string, ReturnType<typeof acc>>();
      const byP = new Map<string, ReturnType<typeof acc>>();
      const add = (m: Map<string, ReturnType<typeof acc>>, k: string, mb: number, rev: number, cost: number) => {
        const a = m.get(k) ?? acc();
        a.mb += mb;
        a.revenue += rev;
        a.cost += cost;
        m.set(k, a);
      };
      const w = { cost: 0, markup: 0, discount: 0 };
      let revenue = 0;
      let cost = 0;
      let mbTotal = 0;
      let est = 0;
      forEachPackageDay(
        s,
        (p, date, lines, charge, owner) => {
          // revenue booked per package-day: the cent-rounded reseller charge, or the retail price for direct sales
          const dayRevenue = owner === null ? lines.reduce((a, l) => a + l.revenue, 0) : charge;
          const dayCost = lines.reduce((a, l) => a + l.cost, 0);
          const dayMb = lines.reduce((a, l) => a + l.mb, 0);
          revenue += dayRevenue;
          cost += dayCost;
          mbTotal += dayMb;
          if (lines[0]!.estimated) est += dayRevenue;
          w.cost += dayCost;
          w.markup += lines.reduce((a, l) => a + l.markupAmount, 0);
          const sl = series.get(bucketOf(date, period.granularity));
          if (sl) {
            sl.revenue += dayRevenue;
            sl.cost += dayCost;
          }
          add(byR, owner ?? "direct", dayMb, dayRevenue, dayCost);
          add(byP, p.planId, dayMb, dayRevenue, dayCost);
          // split the day's revenue over its network lines in proportion to each line's revenue
          const lineRev = lines.reduce((a, l) => a + l.revenue, 0) || 1;
          for (const l of lines) {
            const share = l.revenue / lineRev;
            add(byC, l.iso2, l.mb, dayRevenue * share, l.cost);
            add(byN, l.networkId, l.mb, dayRevenue * share, l.cost);
          }
        },
        { packages: (_p, owner) => (!opts.resellerId ? true : opts.resellerId === "direct" ? owner === null : owner === opts.resellerId), from: period.from, to: period.to },
      );
      // the waterfall closes exactly: discount = Yesim cost + markup − revenue (revenue is cent-rounded per day)
      w.discount = w.cost + w.markup - revenue;
      const rows = (m: Map<string, ReturnType<typeof acc>>, label: (k: string) => string) =>
        [...m.entries()].map(([k, a]) => profitRow(k, label(k), a)).sort((a, b) => b.revenue - a.revenue);

      // reconciliation: all usage to date, not just the period
      const bal = supplierBalance(s);
      return {
        totals: { revenue: round2(revenue), cost: round2(cost), profit: round2(round2(revenue) - round2(cost)), marginPercent: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0, mb: mbTotal, estimatedRevenue: round2(est) },
        series: buckets.map((b) => {
          const x = series.get(b)!;
          return { bucket: b, revenue: round2(x.revenue), cost: round2(x.cost), profit: round2(x.revenue - x.cost) };
        }),
        // shown amounts close exactly: discount = cost + markup − revenue, after rounding each
        waterfall: { cost: round2(w.cost), markup: round2(w.markup), discount: round2(round2(w.cost) + round2(w.markup) - round2(revenue)), revenue: round2(revenue), profit: round2(round2(revenue) - round2(w.cost)) },
        byReseller: rows(byR, (k) => (k === "direct" ? "Direct sales" : resellerName(s, k))),
        byCountry: rows(byC, (k) => CATALOGUE.networks.find((n) => n.iso2 === k)?.country ?? k),
        byNetwork: rows(byN, (k) => {
          const n = NETWORK_BY_ID.get(k)!;
          return `${n.operator} (${n.country})`;
        }),
        byPlan: rows(byP, (k) => planName(s, k)),
        reconciliation: {
          ...bal,
          depositsList: s.supplier.deposits.map((d) => ({ date: d.date, amount: d.amount, reference: d.reference })),
        },
      };
    }),

  // ---------------------------------------------------------- price history
  listPriceVersions: () =>
    read((): PriceVersion[] => {
      const c = authorize("price_lists");
      if (!c.tenant) throw new ApiError(403, "FORBIDDEN");
      const last = c.s.priceVersions[c.s.priceVersions.length - 1]!.version;
      return [...c.s.priceVersions].reverse().map((v) => ({
        version: v.version,
        effectiveFrom: v.effectiveFrom,
        syncedAt: v.syncedAt,
        changes: v.changes.length,
        rises: v.changes.filter((x) => x.newCost > x.oldCost).length,
        falls: v.changes.filter((x) => x.newCost < x.oldCost).length,
        current: v.version === last,
      }));
    }),
  /** What changed in a version, and what it did to each reseller's price per GB (today's markups and discounts). */
  getPriceChanges: (version: number) =>
    read((): PriceChange[] => {
      const c = authorize("price_lists");
      if (!c.tenant) throw new ApiError(403, "FORBIDDEN");
      const v = c.s.priceVersions.find((x) => x.version === version);
      if (!v) throw new ApiError(404, "NOT_FOUND");
      const active = c.s.resellers.filter((r) => r.status === "active");
      return v.changes
        .map((ch) => {
          const n = NETWORK_BY_ID.get(ch.networkId)!;
          return {
            networkId: n.id,
            operator: n.operator,
            iso2: n.iso2,
            country: n.country,
            oldCost: ch.oldCost,
            newCost: ch.newCost,
            deltaPercent: ((ch.newCost - ch.oldCost) / ch.oldCost) * 100,
            impact: active.map((r) => {
              const f = (1 + r.markupPercent / 100) * (1 - discountFor(c.s, r.id, null) / 100) * 1024;
              return { resellerId: r.id, resellerName: r.companyName, oldPerGb: ch.oldCost * f, newPerGb: ch.newCost * f };
            }),
          };
        })
        .sort((a, b) => b.deltaPercent - a.deltaPercent);
    }),
  listMarkupHistory: (resellerId?: string | null) =>
    read((): MarkupChange[] => {
      const c = authorize("resellers");
      if (!c.tenant) throw new ApiError(403, "FORBIDDEN");
      return c.s.markupHistory
        .filter((m) => m.resellerId !== "house" && (!resellerId || m.resellerId === resellerId))
        .map((m) => ({
          id: m.id,
          resellerId: m.resellerId,
          resellerName: resellerName(c.s, m.resellerId),
          effectiveFrom: m.effectiveFrom,
          markupPercent: m.markupPercent,
          previousPercent: m.previousPercent,
          changedAt: m.changedAt,
          changedBy: userName(c.s, m.changedBy),
          reason: m.reason,
        }))
        .sort((a, b) => b.changedAt.localeCompare(a.changedAt));
    }),

  // -------------------------------------------------- invoices and statements
  listInvoices: (filters: { kind?: InvoiceKind | null; resellerId?: string | null } = {}) =>
    read((): InvoiceSummary[] => {
      const c = authorize(["invoices", "resellers"]);
      return allInvoices(c.s).filter(
        (d) => (c.tenant ? !filters.resellerId || (filters.resellerId === "direct" ? d.resellerId === null : d.resellerId === filters.resellerId) : d.resellerId === c.resellerId) && (!filters.kind || d.kind === filters.kind),
      );
    }),
  getInvoice: (id: string) =>
    read((): InvoiceDetail => {
      const c = authorize(["invoices", "resellers"]);
      const d = allInvoices(c.s).find((x) => x.id === id);
      if (!d || (!c.tenant && d.resellerId !== c.resellerId)) throw new ApiError(404, "NOT_FOUND");
      const base = { ...d, usage: [], topups: [], releases: [], totals: { opening: 0, usage: 0, topups: 0, other: 0, closing: 0, releases: 0 }, taxWording: c.s.settings.taxWording, watermark: c.s.settings.watermark[d.kind], lines: [] as { label: string; amount: number }[] };
      if (d.kind === "statement" && d.resellerId && d.period) {
        const from = `${d.period}-01`;
        const to = monthEnd(d.period);
        // usage per plan per day: the same package-day charges the ledger was built from
        const byPlanDay = new Map<string, { date: string; planName: string; mb: number; amount: number; estimated: boolean }>();
        forEachPackageDay(
          c.s,
          (p, date, lines, charge) => {
            const k = `${date}|${p.name}`;
            const row = byPlanDay.get(k) ?? { date, planName: p.name, mb: 0, amount: 0, estimated: false };
            row.mb += lines.reduce((a, l) => a + l.mb, 0);
            row.amount = round2(row.amount + charge);
            row.estimated ||= lines[0]!.estimated;
            byPlanDay.set(k, row);
          },
          { packages: (_p, owner) => owner === d.resellerId, from, to },
        );
        const usage = [...byPlanDay.values()].sort((a, b) => a.date.localeCompare(b.date) || a.planName.localeCompare(b.planName));
        const topups = c.s.topups
          .filter((t) => t.resellerId === d.resellerId && t.status === "approved" && t.decidedAt && t.decidedAt.slice(0, 10) >= from && t.decidedAt.slice(0, 10) <= to)
          .map((t) => ({ date: t.decidedAt!.slice(0, 10), reference: t.receiptNumber ?? t.paymentReference, amount: t.amount }));
        const releases = c.s.holds
          .filter((h) => h.walletId === `w-${d.resellerId}` && h.status === "settled" && h.amount > h.used)
          .map((h) => {
            const p = c.s.packages.find((x) => x.id === h.packageId)!;
            return { date: (p.expiresAt ?? h.createdAt).slice(0, 10), planName: p.name, amount: round2(h.amount - h.used) };
          })
          .filter((r) => r.date >= from && r.date <= to);
        // balances from the wallet ledger; holds are memo lines and never move the balance
        const ledgerDay = (l: DState["ledger"][number]) => (l.type === "usage_charge" ? l.reference.slice(3) : dateInZone(new Date(l.createdAt)));
        const moves = c.s.ledger.filter((l) => l.walletId === `w-${d.resellerId}` && l.type !== "hold" && l.type !== "hold_release");
        const opening = round2(moves.filter((l) => ledgerDay(l) < from).at(-1)?.balanceAfter ?? 0);
        const closing = round2(moves.filter((l) => ledgerDay(l) <= to).at(-1)?.balanceAfter ?? 0);
        const totals = { usage: round2(usage.reduce((a, u) => a + u.amount, 0)), topups: round2(topups.reduce((a, t) => a + t.amount, 0)), releases: round2(releases.reduce((a, r) => a + r.amount, 0)) };
        // anything else that moved the balance (adjustments, recovered outstanding amounts)
        const other = round2(closing - opening - totals.topups + totals.usage);
        return { ...base, usage, topups, releases, totals: { ...totals, opening, other, closing } };
      }
      if (d.kind === "receipt") return { ...base, lines: [{ label: "Wallet top-up (bank transfer)", amount: Number(d.amount) }] };
      return { ...base, lines: [{ label: d.title.replace("Direct sale, ", "eSIM with "), amount: Number(d.amount) }] };
    }),

  // ---------------------------------------------------------------- settings
  getSettings: () =>
    read((): TenantSettings => {
      const c = authorize("settings");
      return settingsView(c);
    }),
  updateSettings: (input: Partial<Omit<TenantSettings, "timeZone" | "currency" | "mfaRequired">>) =>
    write((): TenantSettings => {
      const c = authorize("settings", "manage");
      requireRole(c, "admin");
      const st = c.s.settings;
      const changed: string[] = [];
      // a new retail markup applies to usage rated from now on; the history keeps past days' rate
      if (input.retailMarkupPercent !== undefined && input.retailMarkupPercent !== st.retailMarkupPercent)
        c.s.markupHistory.push({
          id: `mh${++c.s.seq}`,
          resellerId: "house",
          effectiveFrom: addDays(c.s.seededOn, 1),
          markupPercent: input.retailMarkupPercent,
          previousPercent: st.retailMarkupPercent,
          changedAt: new Date().toISOString(),
          changedBy: c.u.id,
          reason: "Retail markup changed in settings",
        });
      const diff: { field: string; before: string; after: string }[] = [];
      const show = (x: unknown) => (typeof x === "object" ? Object.entries(x as object).map(([k, on]) => `${k} ${on ? "on" : "off"}`).join(", ") : String(x));
      for (const [k, v] of Object.entries(input)) {
        if (v === undefined) continue;
        const key = k as keyof typeof st;
        if (JSON.stringify(st[key]) !== JSON.stringify(v)) {
          changed.push(k);
          diff.push({ field: SETTING_LABEL[k] ?? k, before: show(st[key]), after: show(v) });
        }
        (st as Record<string, unknown>)[key] = v;
      }
      if (changed.length) audit(c, "settings.updated", "settings", "tenant", `Settings changed: ${changed.join(", ")}`, null, diff);
      return settingsView(c);
    }),
};

function settingsView(c: Caller): TenantSettings {
  const st = c.s.settings;
  return {
    timeZone: "Asia/Colombo",
    currency: "EUR",
    defaultMarkupPercent: st.defaultMarkupPercent,
    retailMarkupPercent: st.retailMarkupPercent,
    spreadWarningRatio: st.spreadWarningRatio,
    waitingPlanCancelDays: st.waitingPlanCancelDays,
    houseWalletLowThreshold: st.houseWalletLowThreshold,
    lowWalletThreshold: st.lowWalletThreshold,
    lowStockThreshold: st.lowStockThreshold,
    watermark: { ...st.watermark },
    taxWording: st.taxWording,
    mfaRequired: true,
  };
}

export type FinanceApi = typeof demoFinance;
