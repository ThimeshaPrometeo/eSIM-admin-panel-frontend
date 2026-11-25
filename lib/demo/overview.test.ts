import { beforeEach, describe, expect, it } from "vitest";
import { demoFinance } from "@/lib/api/finance.demo";
import { demoOverview, runwayLevel } from "@/lib/api/overview.demo";
import { addDays } from "@/lib/platform/dates";
import type { OverviewQuery, ResellerOverview, TenantOverview } from "@/lib/platform/types";
import { round2 } from "./rating";
import { createSeed } from "./seed";
import { __setLatency, __setState, db } from "./store";
import { supplierBalance } from "./supplier";

const GB = 1024 ** 3;
const as = (userId: string) => (db().session = { userId, pendingMfaUserId: null });

beforeEach(() => {
  __setLatency(false);
  __setState(createSeed(new Date()));
  as("u-admin");
});

const days = (n: number, extra: Partial<OverviewQuery> = {}): OverviewQuery => {
  const today = db().seededOn;
  return { from: addDays(today, -(n - 1)), to: today, granularity: "day", compare: true, ...extra };
};
const tenant = async (q: OverviewQuery) => (await demoOverview.getOverview(q)) as TenantOverview;

describe("dashboard overview (admin)", () => {
  it("revenue, cost and profit equal Profit and costs, in total and per day", async () => {
    for (const resellerId of [null, "r1", "direct"]) {
      const q = days(30, { resellerId });
      const o = await tenant(q);
      const r = await demoFinance.getProfitReport(q, { resellerId });
      expect(o.kpis.revenue.value).toBe(r.totals.revenue);
      expect(o.kpis.cost.value).toBe(r.totals.cost);
      expect(o.kpis.profit.value).toBe(r.totals.profit);
      o.series.forEach((b, i) => {
        expect(b.revenue).toBe(r.series[i]!.revenue);
        expect(b.cost).toBe(r.series[i]!.cost);
      });
    }
  });

  it("each day's bar adds up: Yesim cost + profit = revenue", async () => {
    const o = await tenant(days(30));
    for (const b of o.series) expect(round2(b.cost + b.profit)).toBeCloseTo(b.revenue, 2);
  });

  it("country and network breakdowns add up to the totals", async () => {
    const o = await tenant(days(30));
    const sum = (xs: { revenue: number; cost: number }[], k: "revenue" | "cost") => xs.reduce((a, x) => a + x[k], 0);
    expect(sum(o.countries, "revenue")).toBeCloseTo(o.kpis.revenue.value, 0);
    expect(sum(o.networks, "cost")).toBeCloseTo(o.kpis.cost.value, 0);
    expect(o.countries.reduce((a, c) => a + c.bytes, 0)).toBeCloseTo(o.kpis.bytes.value, -3);
  });

  it("a country filter narrows every figure to that country", async () => {
    const all = await tenant(days(30));
    const it = await tenant(days(30, { iso2: "IT" }));
    const row = all.countries.find((c) => c.iso2 === "IT")!;
    expect(it.kpis.revenue.value).toBeCloseTo(row.revenue, 1);
    expect(it.countries.map((c) => c.iso2)).toEqual(["IT"]);
    expect(it.kpis.revenue.value).toBeLessThan(all.kpis.revenue.value);
  });

  it("compare off: no previous figures", async () => {
    const o = await tenant(days(7, { compare: false }));
    expect(o.kpis.revenue.previous).toBeNull();
    expect(o.series.every((b) => b.previousRevenue === null)).toBe(true);
    expect(o.resellers.every((r) => r.trend === null)).toBe(true);
  });

  it("Yesim runway = balance ÷ average daily cost of the last 7 full days, coloured by the Settings thresholds", async () => {
    const o = await tenant(days(7));
    const sup = o.kpis.supplier;
    expect(sup.balance).toBe(supplierBalance(db()).reported);
    expect(sup.runwayDays).toBeCloseTo(sup.balance / sup.avgDailyCost, 0);
    expect(sup.level).toBe(runwayLevel(sup.runwayDays, 14, 7));
    db().settings.supplierRunwayWarnDays = 400;
    db().settings.supplierRunwayCriticalDays = 300;
    const red = await tenant(days(7));
    expect(red.kpis.supplier.level).toBe("critical");
    expect(red.attention.some((a) => a.key === "low_runway")).toBe(true);
  });

  it("free eSIM stock: days left from the average daily sales", async () => {
    const o = await tenant(days(7));
    expect(o.kpis.stock.free).toBe(57);
    expect(o.kpis.stock.daysLeft).toBeCloseTo(57 / o.kpis.stock.avgDailySales, 5);
    expect(runwayLevel(5, 7, 3)).toBe("warning");
    expect(runwayLevel(2, 7, 3)).toBe("critical");
    expect(runwayLevel(null, 7, 3)).toBe("ok");
  });

  it("needs attention: counts with links to the filtered pages", async () => {
    const o = await tenant(days(30));
    const item = (k: string) => o.attention.find((a) => a.key === k);
    expect(item("topups")).toMatchObject({ count: db().topups.filter((t) => t.status === "pending").length, href: "/esim/topup-requests" });
    expect(item("orders_checking")?.href).toBe("/esim/orders?status=needs_check");
    expect(item("plans_waiting")!.count).toBeGreaterThanOrEqual(3);
    expect(item("plans_waiting")!.href).toBe("/esim/esims?planState=needs_funds");
    expect(item("late_reports")?.href).toBe("/esim/alerts?type=usage_rating_late");
    expect(o.attention.every((a) => a.count > 0)).toBe(true);
  });

  it("staff without profit reports see no money", async () => {
    as("u-support");
    const o = await tenant(days(30));
    expect(o.money).toBe(false);
    expect(o.kpis.revenue.value).toBe(0);
    expect(o.kpis.supplier.balance).toBe(0);
    expect(o.resellers).toEqual([]);
    expect(o.kpis.bytes.value).toBeGreaterThan(0);
  });
});

describe("dashboard overview (reseller)", () => {
  it("spend equals the wallet's usage charges; never Yesim cost, markup or profit", async () => {
    as("u-r1");
    const q = days(30);
    const o = (await demoOverview.getOverview(q)) as ResellerOverview;
    expect(o.scope).toBe("reseller");
    const ledger = round2(-db().ledger.filter((l) => l.walletId === "w-r1" && l.type === "usage_charge" && l.reference.slice(3) >= q.from).reduce((a, l) => a + l.amount, 0));
    expect(o.kpis.spend.value).toBeCloseTo(ledger, 2);
    const json = JSON.stringify(o);
    for (const word of ["cost", "profit", "markup", "revenue", "margin"]) expect(json.toLowerCase()).not.toContain(`"${word}`);
  });

  it("asking for another reseller still returns your own scope", async () => {
    as("u-r1");
    const mine = (await demoOverview.getOverview(days(30))) as ResellerOverview;
    const other = (await demoOverview.getOverview(days(30, { resellerId: "r2" }))) as ResellerOverview;
    expect(other.kpis.spend.value).toBe(mine.kpis.spend.value);
  });

  it("an assistant with dashboard access sees their reseller's dashboard", async () => {
    as("u-sahan");
    const o = (await demoOverview.getOverview(days(7))) as ResellerOverview;
    expect(o.scope).toBe("reseller");
    expect(o.kpis.wallet.available).toBeGreaterThanOrEqual(0);
  });

  it("a waiting or blocked plan, a low balance and pending top-ups show up", async () => {
    as("u-r1");
    const o = (await demoOverview.getOverview(days(30))) as ResellerOverview;
    expect(o.attention.find((a) => a.key === "plans_waiting")!.count).toBeGreaterThanOrEqual(2);
    expect(o.attention.some((a) => a.key === "low_balance")).toBe(true);
    as("u-r4");
    const r4 = (await demoOverview.getOverview(days(30))) as ResellerOverview;
    expect(r4.attention.find((a) => a.key === "topups")?.count).toBe(1);
  });
});

describe("demo data shape (docs/demo-data.md)", () => {
  it("about 900–1,000 GB and €900–1,000 Yesim cost a week; 57 free eSIMs; a Yesim balance near €5,000", async () => {
    const o = await tenant(days(28, { compare: false }));
    const weeks = 4;
    expect(o.kpis.bytes.value / GB / weeks).toBeGreaterThan(750);
    expect(o.kpis.bytes.value / GB / weeks).toBeLessThan(1100);
    expect(o.kpis.cost.value / weeks).toBeGreaterThan(800);
    expect(o.kpis.cost.value / weeks).toBeLessThan(1150);
    expect(o.kpis.stock.free).toBe(57);
    expect(o.kpis.supplier.balance).toBeGreaterThan(4500);
    expect(o.kpis.supplier.balance).toBeLessThan(5600);
  });

  it("top countries by revenue: Italy, UAE, Morocco, Spain", async () => {
    const o = await tenant(days(30));
    expect(o.countries.slice(0, 4).map((c) => c.iso2)).toEqual(["IT", "AE", "MA", "ES"]);
  });

  it("the named networks lead: DU, Etisalat, Iliad, Vodafone, Wind, TIM, Maroc Telecom, Movistar", async () => {
    const o = await tenant(days(30));
    const top = o.networks
      .slice()
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 8)
      .map((n) => n.operator.split(" ")[0]);
    expect(new Set(top)).toEqual(new Set(["DU", "Etisalat", "Iliad", "Vodafone", "Wind", "TIM", "Maroc", "Movistar"]));
  });
});

describe("one stock pace", () => {
  it("free eSIM days on the dashboard match the Inventory page (last 30 days' sales)", async () => {
    const { demoOperations } = await import("@/lib/api/operations.demo");
    const inv = await demoOperations.getInventory();
    const o = await tenant(days(7));
    expect(o.kpis.stock.avgDailySales).toBeCloseTo(inv.sold30d / 30, 10);
    expect(Math.floor(o.kpis.stock.daysLeft!)).toBe(Math.floor(inv.free / (inv.sold30d / 30)));
  });
});

describe("live feed", () => {
  it("is newest first, never in the future, each event with a country", async () => {
    const o = await tenant(days(7));
    expect(o.live.length).toBeGreaterThan(0);
    for (let i = 1; i < o.live.length; i++) expect(o.live[i - 1]!.at >= o.live[i]!.at).toBe(true);
    for (const e of o.live) {
      expect(Date.parse(e.at)).toBeLessThanOrEqual(Date.now());
      expect(e.iso2).toMatch(/^[A-Z]{2}$/);
    }
    expect(Date.parse(o.generatedAt)).toBeGreaterThan(0);
  });

  it("a reseller sees only their own events, without reseller names", async () => {
    as("u-r1");
    const o = (await demoOverview.getOverview(days(7))) as ResellerOverview;
    const names = db().resellers.map((r) => r.companyName);
    expect(o.live.length).toBeGreaterThan(0);
    for (const e of o.live) expect(names.some((n) => e.text.includes(n))).toBe(false);
    const own = new Set(db().esims.filter((e) => e.resellerId === "r1").map((e) => `u-${e.id}`));
    const ownOrders = new Set(db().orders.filter((x) => x.resellerId === "r1").map((x) => `o-${x.id}`));
    for (const e of o.live) expect(own.has(e.id) || ownOrders.has(e.id)).toBe(true);
  });
});
