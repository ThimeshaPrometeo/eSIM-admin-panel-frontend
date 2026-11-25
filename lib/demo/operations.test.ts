import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoOperations } from "@/lib/api/operations.demo";
import { addDays } from "@/lib/platform/dates";
import { round2 } from "./rating";
import { createSeed } from "./seed";
import { __setLatency, __setState, db } from "./store";

const NOW = new Date("2026-11-23T06:00:00Z");
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  __setLatency(false);
  __setState(createSeed(NOW));
  db().session = { userId: "u-admin", pendingMfaUserId: null };
});
const as = (userId: string) => (db().session = { userId, pendingMfaUserId: null });

describe("operations", () => {
  it("usage report charges = the wallet's usage charges in the period", async () => {
    const s = db();
    const from = addDays(s.seededOn, -29);
    const r = await demoOperations.getUsageReport({ from, to: s.seededOn, granularity: "day" }, { resellerId: "r1" });
    const ledger = round2(-s.ledger.filter((l) => l.walletId === "w-r1" && l.type === "usage_charge" && l.reference.slice(3) >= from).reduce((a, l) => a + l.amount, 0));
    expect(r.totals.charge).toBeCloseTo(ledger, 2);
    expect(r.series.reduce((a, b) => a + b.finalBytes + b.estimatedBytes, 0)).toBeCloseTo(r.totals.bytes, 0);
    // never charged below Yesim cost (tiny rows can round to the same cent)
    expect(r.rows.every((x) => x.yesimCost !== null && x.yesimCost <= x.charge)).toBe(true);
    expect(r.totals.yesimCost!).toBeLessThan(r.totals.charge);
  });

  it("resellers see only their own usage, without Yesim cost", async () => {
    as("u-r1");
    const s = db();
    const r = await demoOperations.getUsageReport({ from: addDays(s.seededOn, -29), to: s.seededOn, granularity: "day" }, { resellerId: "r2" });
    const own = new Set(s.esims.filter((e) => e.resellerId === "r1").map((e) => e.id));
    expect(r.rows.length).toBeGreaterThan(0);
    expect(r.rows.every((x) => own.has(x.esimId) && x.yesimCost === null)).toBe(true);
    expect(r.totals.yesimCost).toBeNull();
  });

  it("stock: today's free count, never negative, and the dip the low-stock alert reports", async () => {
    const inv = await demoOperations.getInventory();
    expect(inv.series.at(-1)!.free).toBe(inv.free);
    expect(inv.series.at(-1)!.assigned).toBe(db().esims.length);
    expect(Math.min(...inv.series.map((x) => x.free))).toBeGreaterThanOrEqual(0);
    const delivery = db().stockDeliveries.find((d) => d.reference === "STOCK-2026-04")!;
    expect(inv.series.find((x) => x.date === addDays(delivery.date, -1))!.free).toBe(17);
    // the only time stock went below the warning is the one the low-stock alert reports
    const below = inv.series.filter((x) => x.free < inv.threshold).map((x) => x.date);
    expect(below.every((d) => d < delivery.date && d > addDays(delivery.date, -10))).toBe(true);
  });

  it("alerts are scoped to the reseller; resellers can't change them", async () => {
    as("u-r1");
    const mine = await demoOperations.listAlerts();
    expect(mine.length).toBeGreaterThan(0);
    const own = new Set(db().esims.filter((e) => e.resellerId === "r1").map((e) => e.id));
    expect(mine.every((a) => a.esimId && own.has(a.esimId))).toBe(true);
    await expect(demoOperations.setAlertStatus(mine[0]!.id, "resolved")).rejects.toMatchObject({ status: 403 });
    as("u-admin");
    const all = await demoOperations.listAlerts({ status: "active" });
    expect(all.length).toBeGreaterThan(mine.length);
    const done = await demoOperations.setAlertStatus(all[0]!.id, "resolved");
    expect(done.status).toBe("resolved");
    expect(done.updatedByName).toBe("Nadeesha Perera");
  });

  it("every alert type is present, and rules can be added, changed and removed", async () => {
    const types = new Set((await demoOperations.listAlerts()).map((a) => a.type));
    expect(types.size).toBe(10);
    const r = await demoOperations.createAlertRule({ thresholdPercent: 90, action: "notify", enabled: true });
    await expect(demoOperations.createAlertRule({ thresholdPercent: 90, action: "notify", enabled: true })).rejects.toMatchObject({ status: 409 });
    expect((await demoOperations.updateAlertRule(r.id, { thresholdPercent: 95, action: "notify", enabled: false })).thresholdPercent).toBe(95);
    await demoOperations.deleteAlertRule(r.id);
    expect((await demoOperations.listAlertRules()).map((x) => x.thresholdPercent)).toEqual([80, 100]);
  });

  it("customers: scoped detail and edits", async () => {
    as("u-r1");
    const other = db().customers.find((c) => c.resellerId === "r2")!;
    await expect(demoOperations.getCustomer(other.id)).rejects.toMatchObject({ status: 404 });
    const mine = db().customers.find((c) => c.resellerId === "r1" && db().esims.some((e) => e.customerId === c.id))!;
    const d = await demoOperations.getCustomer(mine.id);
    expect(d.esims.length).toBe(d.esimCount);
    const u = await demoOperations.updateCustomer(mine.id, { name: "New Name", email: "new@example.com", phone: "+94 77 000 0000" });
    expect(u.name).toBe("New Name");
  });

  it("Yesim connection: same balance as the reconciliation; Sync now updates the price list time", async () => {
    const st = await demoOperations.getSupplierStatus();
    expect(st.balance.difference).toBeCloseTo(-3.82, 2);
    expect(st.jobs).toHaveLength(6);
    const run = await demoOperations.runSupplierJob("price_list_sync");
    expect((await demoOperations.getSupplierStatus()).priceList.syncedAt).toBe(run.at);
    as("u-support");
    await expect(demoOperations.runSupplierJob("catalogue_sync")).rejects.toMatchObject({ status: 403 });
  });
});
