import { beforeEach, describe, expect, it } from "vitest";
import { demoFinance } from "@/lib/api/finance.demo";
import { demoOverview, runwayLevel } from "@/lib/api/overview.demo";
import { addDays } from "@/lib/platform/dates";
import type { OverviewQuery, ResellerOverview, TenantOverview } from "@/lib/platform/types";
import { round2 } from "./rating";
import { createSeed } from "./seed";
import { __setLatency, __setState, db } from "./store";
import { supplierBalance } from "./supplier";

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
  /** The last 28 final days (the two estimated days left out: they are priced provisionally). */
  const finalWeeks = () => {
    const today = db().seededOn;
    return { from: addDays(today, -29), to: addDays(today, -2), granularity: "day" as const, compare: false };
  };

  it("about 900–1,000 GB and €1,000–1,400 Yesim cost a week on final days; 57 free eSIMs; a Yesim balance near €5,000", async () => {
    // final lines only (late-report days are still estimated, at the zone's highest price)
    const { forEachBookedLine } = await import("./booked");
    const w = finalWeeks();
    let mb = 0;
    let cost = 0;
    forEachBookedLine(db(), (l) => {
      if (l.estimated) return;
      mb += l.mb;
      cost += l.cost;
    }, { from: w.from, to: w.to });
    const weeks = 4;
    expect(mb / 1024 / weeks).toBeGreaterThan(850);
    expect(mb / 1024 / weeks).toBeLessThan(1100);
    expect(cost / weeks).toBeGreaterThan(950);
    expect(cost / weeks).toBeLessThan(1450);
    const o = await tenant(w);
    expect(o.kpis.stock.free).toBe(57);
    expect(o.kpis.supplier.balance).toBeGreaterThan(4500);
    expect(o.kpis.supplier.balance).toBeLessThan(5600);
  });

  it("a long tail: 60–90 countries and 150–250 networks, only priced ones", async () => {
    const o = await tenant(days(30));
    expect(o.countries.length).toBeGreaterThanOrEqual(60);
    expect(o.countries.length).toBeLessThanOrEqual(90);
    expect(o.networks.length).toBeGreaterThanOrEqual(150);
    expect(o.networks.length).toBeLessThanOrEqual(250);
    const { NETWORK_BY_ID } = await import("./catalogue");
    for (const n of o.networks) expect(NETWORK_BY_ID.get(n.id)?.costPerMb).not.toBeNull();
  });

  it("the top 5 countries by data are Italy, Spain, UAE, Thailand and Morocco, carrying 60–70% of data", async () => {
    const o = await tenant(finalWeeks());
    const byData = [...o.countries].sort((a, b) => b.bytes - a.bytes);
    expect(new Set(byData.slice(0, 5).map((c) => c.iso2))).toEqual(new Set(["IT", "ES", "AE", "TH", "MA"]));
    const share = byData.slice(0, 5).reduce((a, c) => a + c.bytes, 0) / o.kpis.bytes.value;
    expect(share).toBeGreaterThan(0.58);
    expect(share).toBeLessThan(0.7);
  });

  it("by revenue the top 5 are Italy, UAE, Morocco, Spain and Thailand (expensive networks rank Morocco and the UAE higher)", async () => {
    const o = await tenant(finalWeeks());
    expect(new Set(o.countries.slice(0, 5).map((c) => c.iso2))).toEqual(new Set(["IT", "AE", "MA", "ES", "TH"]));
  });

  it("several networks per country, and some trips cross 2–3 countries", async () => {
    const o = await tenant(days(30));
    expect(o.networks.filter((n) => n.iso2 === "IT").length).toBe(4);
    expect(o.networks.filter((n) => n.iso2 === "ES").length).toBeGreaterThanOrEqual(3);
    const { NETWORK_BY_ID } = await import("./catalogue");
    const trips = db().packages.filter((p) => (p.legs?.length ?? 0) > 1);
    expect(trips.length).toBeGreaterThan(100);
    for (const p of trips.slice(0, 50)) {
      const countries = new Set(p.legs!.map((l) => NETWORK_BY_ID.get(l.networkId)!.iso2));
      expect(countries.size).toBe(p.legs!.length);
      expect(p.legs!.length).toBeLessThanOrEqual(3);
    }
  });

  it("estimated days are priced at the zone's highest network price; final days at the network's own", async () => {
    const { forEachPackageDay, zoneMaxCost, costAt } = await import("./rating");
    const s = db();
    let checkedEstimated = 0;
    let checkedFinal = 0;
    forEachPackageDay(s, (p, date, lines) => {
      const zone = s.plans.find((x) => x.id === p.planId)!.zoneId;
      for (const l of lines) {
        if (l.estimated) {
          expect(l.costPerMb).toBe(zoneMaxCost(s, zone, date));
          checkedEstimated++;
        } else if (checkedFinal < 200) {
          expect(l.costPerMb).toBe(costAt(s, l.networkId, date));
          checkedFinal++;
        }
      }
    }, { from: addDays(s.seededOn, -3) });
    expect(checkedEstimated).toBeGreaterThan(0);
    expect(checkedFinal).toBeGreaterThan(0);
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
