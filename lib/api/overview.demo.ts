/**
 * The dashboard overview (spec 8.1, redesign 2026-11): revenue, Yesim cost,
 * profit and what needs attention, in the viewer's scope.
 *
 * Every money figure comes from the booked usage lines (lib/demo/booked), the
 * same formula as Profit and costs, statements and wallets, so the totals
 * agree to the cent. Resellers and assistants get their own scope at their
 * price (what their wallet paid); Yesim cost, markup and profit are never
 * computed into their answer.
 */
import { forEachBookedLine, type BookedFilter } from "@/lib/demo/booked";
import { CATALOGUE, NETWORK_BY_ID } from "@/lib/demo/catalogue";
import { available, planState, walletOfReseller, walletSummary } from "@/lib/demo/derive";
import type { DState } from "@/lib/demo/model";
import { forEachPackageDay, round2 } from "@/lib/demo/rating";
import { read } from "@/lib/demo/run";
import { authorize, type Caller } from "@/lib/demo/session";
import { supplierBalance } from "@/lib/demo/supplier";
import { addDays, dateInZone, daysBetween } from "@/lib/platform/dates";
import { can } from "@/lib/platform/permissions";
import { bucketOf, bucketsIn } from "@/lib/platform/period";
import type { AttentionItem, LiveEvent, Overview, OverviewOptions, OverviewQuery, ResellerOverview, RunwayLevel, TenantOverview } from "@/lib/platform/types";

const MB = 1048576;
/** The Yesim runway uses the average cost of the last 7 full days (today is still running). */
const PACE_DAYS = 7;
/** Free-stock days use the same pace as the Inventory page: eSIMs sold in the last 30 days ÷ 30. */
const STOCK_PACE_DAYS = 30;

const COUNTRY_NAME = new Map(CATALOGUE.networks.map((n) => [n.iso2, n.country]));
const countryName = (iso2: string) => COUNTRY_NAME.get(iso2) ?? iso2;

export function runwayLevel(days: number | null, warn: number, critical: number): RunwayLevel {
  if (days === null) return "ok";
  return days < critical ? "critical" : days < warn ? "warning" : "ok";
}

const margin = (revenue: number, cost: number) => (revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0);
const trend = (value: number, previous: number | null) => ({ value, previous });

type Acc = { mb: number; revenue: number; cost: number; charged: number; esims: Set<string> };
const acc = (): Acc => ({ mb: 0, revenue: 0, cost: 0, charged: 0, esims: new Set() });
type Line = { mb: number; booked: number; cost: number; charged: number; esimId: string };
function add(a: Acc, l: Line) {
  a.mb += l.mb;
  a.revenue += l.booked;
  a.cost += l.cost;
  a.charged += l.charged;
  a.esims.add(l.esimId);
}
function bump<K>(m: Map<K, Acc>, k: K, l: Line) {
  const a = m.get(k) ?? acc();
  add(a, l);
  m.set(k, a);
}

/** One pass over the current and previous periods. */
function collect(s: DState, q: OverviewQuery, filter: BookedFilter) {
  const len = daysBetween(q.from, q.to) + 1;
  const prevFrom = addDays(q.from, -len);
  const buckets = bucketsIn(q);
  const prevBuckets = bucketsIn({ from: prevFrom, to: addDays(q.from, -1), granularity: q.granularity });
  const cur = acc();
  const prev = acc();
  const series = new Map(buckets.map((b) => [b, { ...acc(), estimated: false }]));
  const prevSeries = new Map(prevBuckets.map((b) => [b, acc()]));
  const byCountry = new Map<string, Acc>();
  const byNetwork = new Map<string, Acc>();
  const byOwner = new Map<string, Acc>();
  const byOwnerPrev = new Map<string, Acc>();
  const byPlan = new Map<string, Acc>();
  const byCustomer = new Map<string, Acc>();
  const customerOf = new Map(s.esims.map((e) => [e.id, e.customerId]));

  forEachBookedLine(
    s,
    (l, p, owner) => {
      const ownerKey = owner ?? "direct";
      if (l.date < q.from) {
        add(prev, l);
        const pb = prevSeries.get(bucketOf(l.date, q.granularity));
        if (pb) add(pb, l);
        bump(byOwnerPrev, ownerKey, l);
        return;
      }
      add(cur, l);
      const slot = series.get(bucketOf(l.date, q.granularity))!;
      add(slot, l);
      if (l.estimated) slot.estimated = true;
      bump(byCountry, l.iso2, l);
      bump(byNetwork, l.networkId, l);
      bump(byOwner, ownerKey, l);
      bump(byPlan, p.planId, l);
      const cust = customerOf.get(l.esimId);
      if (cust) bump(byCustomer, cust, l);
    },
    { ...filter, from: prevFrom, to: q.to },
  );
  // previous buckets line up with the current ones by position
  const prevByIndex = prevBuckets.map((b) => prevSeries.get(b)!);
  return { cur, prev, buckets, series, prevByIndex, byCountry, byNetwork, byOwner, byOwnerPrev, byPlan, byCustomer };
}

/** Orders sold in the period (completed, or waiting for funds), per plan. */
function soldPerPlan(s: DState, q: OverviewQuery, scope: string | null | undefined) {
  const sold = new Map<string, number>();
  for (const o of s.orders) {
    if (o.status !== "completed" && o.status !== "awaiting_funds") continue;
    if (scope !== undefined && scope !== null && (scope === "direct" ? o.resellerId !== null : o.resellerId !== scope)) continue;
    if (q.planId && o.planId !== q.planId) continue;
    const d = dateInZone(new Date(o.createdAt));
    if (d < q.from || d > q.to) continue;
    sold.set(o.planId, (sold.get(o.planId) ?? 0) + 1);
  }
  return sold;
}

/** Filter choices: countries, networks and plans of every package in scope. */
function filterOptions(s: DState, scope: string | null | undefined): OverviewOptions {
  const nets = new Set<string>();
  const plans = new Set<string>();
  const owner = new Map(s.esims.map((e) => [e.id, e.resellerId]));
  for (const p of s.packages) {
    const o = owner.get(p.esimId) ?? null;
    if (scope && (scope === "direct" ? o !== null : o !== scope)) continue;
    if (!s.usage[p.id]) continue;
    nets.add(p.networkId);
    if (p.altNetworkId) nets.add(p.altNetworkId);
    plans.add(p.planId);
  }
  const networks = [...nets].map((id) => NETWORK_BY_ID.get(id)!).filter(Boolean);
  return {
    countries: [...new Set(networks.map((n) => n.iso2))].map((iso2) => ({ iso2, name: countryName(iso2) })).sort((a, b) => a.name.localeCompare(b.name)),
    networks: networks.map((n) => ({ id: n.id, label: `${n.operator} (${n.country})` })).sort((a, b) => a.label.localeCompare(b.label)),
    plans: [...plans].map((id) => ({ id, name: s.plans.find((p) => p.id === id)?.name ?? id })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Recent sales and eSIM activity in scope, newest first (the live feed). */
function liveEvents(s: DState, scope: string | null | undefined, tenant: boolean, limit = 8): LiveEvent[] {
  const ownerOk = (o: string | null) => !scope || (scope === "direct" ? o === null : o === scope);
  const pkg = new Map(s.packages.map((p) => [p.id, p]));
  const plan = new Map(s.plans.map((p) => [p.id, p.name]));
  const reseller = new Map(s.resellers.map((r) => [r.id, r.companyName]));
  const now = Date.now();
  const events: LiveEvent[] = [];
  for (const o of s.orders) {
    if ((o.status !== "completed" && o.status !== "awaiting_funds") || !ownerOk(o.resellerId) || !o.packageId) continue;
    if (Date.parse(o.createdAt) > now) continue;
    const net = NETWORK_BY_ID.get(pkg.get(o.packageId)?.networkId ?? "");
    if (!net) continue;
    const who = tenant ? ` · ${o.resellerId ? (reseller.get(o.resellerId) ?? "Reseller") : "Direct sale"}` : "";
    // "Italy 3 GB" in Italy reads "3 GB plan sold"; "Europe 10 GB" in Spain stays "Europe 10 GB sold"
    const name = plan.get(o.planId) ?? "Plan";
    const what = name.startsWith(`${net.country} `) ? `${name.slice(net.country.length + 1)} plan` : name;
    events.push({ id: `o-${o.id}`, at: o.createdAt, iso2: net.iso2, country: net.country, kind: "sale", text: `${what} sold${who}` });
  }
  for (const e of s.esims) {
    if (!e.lastActivityAt || !ownerOk(e.resellerId) || Date.parse(e.lastActivityAt) > now) continue;
    const running = s.packages.find((p) => p.esimId === e.id && p.state === "active");
    const net = running ? NETWORK_BY_ID.get(running.networkId) : undefined;
    if (!net) continue;
    events.push({ id: `u-${e.id}`, at: e.lastActivityAt, iso2: net.iso2, country: net.country, kind: "in_use", text: `eSIM using data on ${net.operator.replace(new RegExp(`\\s*${net.country}.*$`), "") || net.operator}` });
  }
  // the newest events, plus the two newest sales so the feed always shows selling too
  events.sort((a, b) => b.at.localeCompare(a.at));
  const keep = new Set([...events.slice(0, limit - 2), ...events.filter((e) => e.kind === "sale").slice(0, 2)]);
  return events.filter((e) => keep.has(e));
}

/** Plans waiting for funds or blocked, in scope. */
function plansNeedingFunds(s: DState, scope: string | null | undefined) {
  let n = 0;
  for (const p of s.packages) {
    const owner = s.esims.find((e) => e.id === p.esimId)?.resellerId ?? null;
    if (scope && (scope === "direct" ? owner !== null : owner !== scope)) continue;
    const st = planState(s, p);
    if (st === "awaiting_funds" || st.startsWith("blocked")) n++;
  }
  return n;
}

function tenantOverview(c: Caller, q: OverviewQuery): TenantOverview {
  const s = c.s;
  const money = can(c.me.permissions, "profit_reports");
  const scope = q.resellerId ?? null;
  const filter: BookedFilter = { resellerId: scope, planId: q.planId, iso2: q.iso2, networkId: q.networkId };
  const d = collect(s, q, filter);
  const m = (n: number) => (money ? round2(n) : 0);
  const cmp = <T,>(v: T) => (q.compare ? v : null);

  // ---- runway: the whole account at the pace of the last 7 full days
  const today = s.seededOn;
  const paceFrom = addDays(today, -PACE_DAYS);
  const paceTo = addDays(today, -1);
  let paceCost = 0;
  forEachPackageDay(s, (_p, _d, lines) => lines.forEach((l) => (paceCost += l.cost)), { from: paceFrom, to: paceTo });
  const avgDailyCost = paceCost / PACE_DAYS;
  const balance = supplierBalance(s).reported;
  const runwayDays = avgDailyCost > 0 ? balance / avgDailyCost : null;
  const st = s.settings;
  const stockFrom = addDays(today, -STOCK_PACE_DAYS);
  const sales = s.esims.filter((e) => dateInZone(new Date(e.createdAt)) > stockFrom).length;
  const avgDailySales = sales / STOCK_PACE_DAYS;
  const daysLeft = avgDailySales > 0 ? st.freeStock / avgDailySales : null;
  const supplierLevel = runwayLevel(runwayDays, st.supplierRunwayWarnDays, st.supplierRunwayCriticalDays);
  const stockLevel = runwayLevel(daysLeft, st.stockRunwayWarnDays, st.stockRunwayCriticalDays);

  // ---- what needs attention
  const inScope = (resellerId: string | null) => !scope || (scope === "direct" ? resellerId === null : resellerId === scope);
  const activeAlerts = (type: string) => s.alerts.filter((a) => a.type === type && a.status !== "resolved" && inScope(a.resellerId)).length;
  const lateDays = Object.entries(s.lateDays)
    .filter(([k]) => inScope(k === "house" ? null : k))
    .reduce((a, [, days]) => a + days.length, 0);
  const attention: AttentionItem[] = [
    { key: "topups" as const, label: "Top-up requests to approve", count: s.topups.filter((t) => t.status === "pending" && inScope(t.resellerId)).length, href: "/esim/topup-requests", tone: "warning" as const },
    { key: "plans_waiting" as const, label: "Plans awaiting funds or blocked", count: plansNeedingFunds(s, scope), href: "/esim/esims?planState=needs_funds", tone: "warning" as const },
    { key: "orders_checking" as const, label: "Orders being verified", count: s.orders.filter((o) => o.status === "needs_check" && inScope(o.resellerId)).length, href: "/esim/orders?status=needs_check", tone: "info" as const },
    {
      key: "low_stock" as const,
      label: "Free eSIMs running low",
      count: stockLevel !== "ok" || st.freeStock < st.lowStockThreshold ? st.freeStock : 0,
      href: "/esim/inventory",
      tone: stockLevel === "critical" || st.freeStock < st.lowStockThreshold ? ("danger" as const) : ("warning" as const),
      detail: daysLeft !== null ? `about ${Math.floor(daysLeft)} days left` : undefined,
    },
    {
      key: "low_runway" as const,
      label: "Yesim balance running low",
      count: money && supplierLevel !== "ok" && runwayDays !== null ? Math.floor(runwayDays) : 0,
      href: "/esim/yesim",
      tone: supplierLevel === "critical" ? ("danger" as const) : ("warning" as const),
      detail: "days left at current spend",
    },
    { key: "unpriced_usage" as const, label: "Usage on networks with no price", count: activeAlerts("unpriced_network_usage"), href: "/esim/alerts?type=unpriced_network_usage", tone: "danger" as const },
    { key: "late_reports" as const, label: "Late usage reports", count: lateDays, href: "/esim/alerts?type=usage_rating_late", tone: "info" as const },
  ].filter((a) => a.count > 0);

  // ---- breakdowns
  const resellers = money
    ? [...s.resellers.map((r) => r.id), "direct"]
        .map((id) => {
          const a = d.byOwner.get(id) ?? acc();
          const pa = d.byOwnerPrev.get(id);
          const w = walletSummary(s, walletOfReseller(s, id === "direct" ? null : id));
          return {
            id,
            name: id === "direct" ? "Direct sales" : (s.resellers.find((r) => r.id === id)?.companyName ?? id),
            revenue: round2(a.revenue),
            profit: round2(round2(a.revenue) - round2(a.cost)),
            marginPercent: margin(a.revenue, a.cost),
            trend: q.compare && pa && pa.revenue > 0 ? (a.revenue - pa.revenue) / pa.revenue : null,
            available: Number(w.available),
            outstanding: id === "direct" ? null : Number(w.outstanding),
          };
        })
        .filter((r) => !scope || r.id === scope)
        .sort((a, b) => b.revenue - a.revenue)
    : [];
  const sold = soldPerPlan(s, q, scope);
  const planIds = new Set([...d.byPlan.keys(), ...sold.keys()]);
  const plans = [...planIds]
    .map((id) => {
      const a = d.byPlan.get(id) ?? acc();
      return {
        id,
        name: s.plans.find((p) => p.id === id)?.name ?? id,
        sold: sold.get(id) ?? 0,
        active: a.esims.size,
        revenue: m(a.revenue),
        profit: money ? round2(round2(a.revenue) - round2(a.cost)) : 0,
        avgBytesPerEsim: a.esims.size ? (a.mb * MB) / a.esims.size : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue || b.sold - a.sold);

  const revenue = round2(d.cur.revenue);
  const cost = round2(d.cur.cost);
  const prevRevenue = round2(d.prev.revenue);
  const prevCost = round2(d.prev.cost);
  return {
    scope: "tenant",
    money,
    kpis: {
      revenue: trend(m(revenue), cmp(m(prevRevenue))),
      cost: trend(m(cost), cmp(m(prevCost))),
      profit: trend(m(revenue - cost), cmp(m(prevRevenue - prevCost))),
      marginPercent: trend(money ? margin(d.cur.revenue, d.cur.cost) : 0, cmp(money ? margin(d.prev.revenue, d.prev.cost) : 0)),
      bytes: trend(d.cur.mb * MB, cmp(d.prev.mb * MB)),
      activeEsims: trend(d.cur.esims.size, cmp(d.prev.esims.size)),
      supplier: {
        balance: money ? balance : 0,
        avgDailyCost: m(avgDailyCost),
        runwayDays: money ? runwayDays : null,
        level: money ? supplierLevel : "ok",
        warnDays: st.supplierRunwayWarnDays,
        criticalDays: st.supplierRunwayCriticalDays,
      },
      stock: { free: st.freeStock, avgDailySales, daysLeft, level: stockLevel, warnDays: st.stockRunwayWarnDays, criticalDays: st.stockRunwayCriticalDays },
    },
    series: d.buckets.map((b, i) => {
      const x = d.series.get(b)!;
      const r = round2(x.revenue);
      const k = round2(x.cost);
      return { bucket: b, bytes: x.mb * MB, estimated: x.estimated, revenue: m(r), cost: m(k), profit: m(r - k), previousRevenue: q.compare && money ? round2(d.prevByIndex[i]?.revenue ?? 0) : null };
    }),
    attention,
    countries: [...d.byCountry.entries()]
      .map(([iso2, a]) => ({ iso2, name: countryName(iso2), revenue: m(a.revenue), cost: m(a.cost), profit: money ? round2(round2(a.revenue) - round2(a.cost)) : 0, bytes: a.mb * MB, marginPercent: money ? margin(a.revenue, a.cost) : 0 }))
      .sort((a, b) => b.revenue - a.revenue || b.bytes - a.bytes),
    networks: [...d.byNetwork.entries()]
      .map(([id, a]) => {
        const n = NETWORK_BY_ID.get(id)!;
        return { id, operator: n.operator, iso2: n.iso2, country: n.country, revenue: m(a.revenue), cost: m(a.cost), profit: money ? round2(round2(a.revenue) - round2(a.cost)) : 0, bytes: a.mb * MB };
      })
      .sort((a, b) => b.bytes - a.bytes),
    resellers,
    plans,
    // the whole tenant: switching reseller doesn't empty the other lists
    options: filterOptions(s, null),
    live: liveEvents(s, scope, true),
    generatedAt: new Date().toISOString(),
  };
}

function resellerOverview(c: Caller, q: OverviewQuery): ResellerOverview {
  const s = c.s;
  const rid = c.resellerId!;
  const d = collect(s, q, { resellerId: rid, planId: q.planId, iso2: q.iso2, networkId: q.networkId });
  const cmp = <T,>(v: T) => (q.compare ? v : null);
  const w = walletOfReseller(s, rid);
  const summary = walletSummary(s, w);
  const today = s.seededOn;
  const paceFrom = addDays(today, -PACE_DAYS);
  let paceSpend = 0;
  forEachBookedLine(s, (l) => (paceSpend += l.charged), { resellerId: rid, from: paceFrom, to: addDays(today, -1) });
  const avgDailySpend = paceSpend / PACE_DAYS;
  const avail = available(s, w);
  const runwayDays = avgDailySpend > 0 ? avail / avgDailySpend : null;
  const outstanding = Number(summary.outstanding);
  const level: RunwayLevel = avail <= 0 || outstanding > 0 ? "critical" : avail < w.lowThreshold ? "warning" : "ok";

  const pendingTopups = s.topups.filter((t) => t.resellerId === rid && t.status === "pending").length;
  const attention: AttentionItem[] = [
    { key: "plans_waiting" as const, label: "Plans awaiting funds or blocked", count: plansNeedingFunds(s, rid), href: "/esim/esims?planState=needs_funds", tone: "warning" as const },
    { key: "outstanding" as const, label: "Outstanding amount to pay", count: outstanding > 0 ? 1 : 0, href: "/esim/wallet", tone: "danger" as const, detail: outstanding > 0 ? `€${outstanding.toFixed(2)}` : undefined },
    { key: "low_balance" as const, label: "Available balance is low", count: avail < w.lowThreshold ? 1 : 0, href: "/esim/wallet", tone: avail <= 0 ? ("danger" as const) : ("warning" as const), detail: `€${avail.toFixed(2)} available` },
    { key: "topups" as const, label: "Top-up waiting for approval", count: pendingTopups, href: "/esim/wallet", tone: "info" as const },
  ].filter((a) => a.count > 0);

  const sold = soldPerPlan(s, q, rid);
  const planIds = new Set([...d.byPlan.keys(), ...sold.keys()]);
  const esimsOfCustomer = new Map<string, number>();
  for (const e of s.esims) if (e.resellerId === rid && e.customerId) esimsOfCustomer.set(e.customerId, (esimsOfCustomer.get(e.customerId) ?? 0) + 1);

  return {
    scope: "reseller",
    kpis: {
      spend: trend(round2(d.cur.charged), cmp(round2(d.prev.charged))),
      bytes: trend(d.cur.mb * MB, cmp(d.prev.mb * MB)),
      activeEsims: trend(d.cur.esims.size, cmp(d.prev.esims.size)),
      customers: s.customers.filter((x) => x.resellerId === rid).length,
      wallet: { available: round2(avail), outstanding, avgDailySpend: round2(avgDailySpend), runwayDays, level, lowThreshold: w.lowThreshold },
    },
    series: d.buckets.map((b, i) => {
      const x = d.series.get(b)!;
      return { bucket: b, bytes: x.mb * MB, estimated: x.estimated, spend: round2(x.charged), previousSpend: q.compare ? round2(d.prevByIndex[i]?.charged ?? 0) : null };
    }),
    attention,
    countries: [...d.byCountry.entries()].map(([iso2, a]) => ({ iso2, name: countryName(iso2), spend: round2(a.charged), bytes: a.mb * MB })).sort((a, b) => b.spend - a.spend),
    networks: [...d.byNetwork.entries()]
      .map(([id, a]) => {
        const n = NETWORK_BY_ID.get(id)!;
        return { id, operator: n.operator, iso2: n.iso2, country: n.country, spend: round2(a.charged), bytes: a.mb * MB };
      })
      .sort((a, b) => b.bytes - a.bytes),
    plans: [...planIds]
      .map((id) => {
        const a = d.byPlan.get(id) ?? acc();
        return { id, name: s.plans.find((p) => p.id === id)?.name ?? id, sold: sold.get(id) ?? 0, active: a.esims.size, spend: round2(a.charged), avgBytesPerEsim: a.esims.size ? (a.mb * MB) / a.esims.size : 0 };
      })
      .sort((a, b) => b.spend - a.spend || b.sold - a.sold),
    customers: [...d.byCustomer.entries()]
      .map(([id, a]) => ({ id, name: s.customers.find((x) => x.id === id)?.name ?? "Customer", esims: esimsOfCustomer.get(id) ?? a.esims.size, spend: round2(a.charged), bytes: a.mb * MB }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10),
    options: filterOptions(s, rid),
    live: liveEvents(s, rid, false),
    generatedAt: new Date().toISOString(),
  };
}

export const demoOverview = {
  /** The dashboard in the viewer's scope. Resellers and assistants always get their own scope. */
  getOverview: (q: OverviewQuery) =>
    read((): Overview => {
      const c = authorize("dashboard");
      return c.tenant ? tenantOverview(c, q) : resellerOverview(c, q);
    }),
};

export type OverviewApi = typeof demoOverview;
