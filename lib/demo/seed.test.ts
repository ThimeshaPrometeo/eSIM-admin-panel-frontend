import { describe, expect, it } from "vitest";
import { isPriced } from "@/lib/platform/coverage";
import type { PlanState } from "@/lib/platform/status";
import { NETWORK_BY_ID, zoneNetworks } from "./catalogue";
import { available, planState, reserved } from "./derive";
import { buyerPricePerMb, discountFor, holdFor, pricePerMb } from "./pricing";
import { createSeed } from "./seed";

const now = new Date("2026-11-23T06:00:00Z");
const s = createSeed(now);

describe("demo seed", () => {
  it("is deterministic for a given day", () => {
    expect(JSON.stringify(createSeed(now))).toBe(JSON.stringify(s));
  });

  it("has the planned amounts", () => {
    expect(s.esims.length).toBeGreaterThanOrEqual(115);
    expect(s.esims.filter((e) => e.resellerId === null).length).toBe(25);
    expect(s.resellers.length).toBe(6);
    expect(s.plans.length).toBe(10);
    expect(s.customers.length).toBe(60);
  });

  it("keeps every wallet consistent: balance = ledger, never negative, available = balance − reserved", () => {
    for (const w of s.wallets) {
      const ledger = s.ledger.filter((l) => l.walletId === w.id && l.type !== "hold" && l.type !== "hold_release");
      const sum = ledger.reduce((a, l) => a + l.amount, 0);
      expect(Math.abs(sum - w.balance)).toBeLessThan(0.02);
      expect(w.balance).toBeGreaterThanOrEqual(-0.005);
      expect(w.outstanding).toBeGreaterThanOrEqual(0);
      expect(reserved(s, w.id)).toBeLessThanOrEqual(w.balance + 0.01);
      for (const l of ledger) expect(l.balanceAfter).toBeGreaterThanOrEqual(-0.01);
    }
  });

  it("tells the wallet stories", () => {
    const w = (id: string) => s.wallets.find((x) => x.id === id)!;
    expect(available(s, w("w-r1"))).toBeCloseTo(0.4, 1);
    expect(s.holds.filter((h) => h.walletId === "w-r1" && h.status === "waiting").length).toBe(2);
    expect(available(s, w("w-r3"))).toBeCloseTo(18, 0);
    expect(w("w-r4").balance).toBeCloseTo(0, 1);
    expect(w("w-r5").outstanding).toBe(14.37);
    expect(s.topups.some((t) => t.resellerId === "r4" && t.status === "pending")).toBe(true);
  });

  it("has every plan state", () => {
    const states = new Set<PlanState>(s.packages.map((p) => planState(s, p)));
    for (const st of ["awaiting_funds", "blocked_no_funds", "blocked_hold_used_up", "blocked_by_admin", "pending_first_use", "active", "expired", "ended"] as PlanState[])
      expect(states, st).toContain(st);
  });

  it("has every eSIM status and the unknown install status", () => {
    const st = s.esims.map((e) => `${e.status}:${e.suspendedBy ?? ""}`);
    expect(st.filter((x) => x === "SUSPENDED:reseller").length).toBe(5);
    expect(st.filter((x) => x === "SUSPENDED:admin").length).toBe(3);
    expect(st.filter((x) => x === "SUSPENDED:rule").length).toBe(1);
    expect(st.filter((x) => x.startsWith("END_OF_LIFE")).length).toBe(2);
    expect(s.esims.some((e) => e.installStatus === "unknown" && e.installStatusRaw === "Pending-Download-Retry")).toBe(true);
  });

  it("prices with the backend formula and the most specific discount", () => {
    expect(pricePerMb(0.002, 25, 10)).toBeCloseTo(0.002 * 1.25 * 0.9, 10);
    expect(discountFor(s, "r1", "p-it3")).toBe(10); // plan-specific wins
    expect(discountFor(s, "r1", "p-eu5")).toBe(5); // reseller-wide
    expect(discountFor(s, "r2", null)).toBe(0);
    const tim = [...NETWORK_BY_ID.values()].find((n) => n.operator === "TIM Italy")!;
    expect(buyerPricePerMb(s, { kind: "reseller", resellerId: "r1" }, tim, "p-it3")).toBeCloseTo(tim.costPerMb! * 1.25 * 0.9, 10);
    expect(buyerPricePerMb(s, { kind: "house" }, tim, null)).toBe(tim.costPerMb);
    const unpriced = [...NETWORK_BY_ID.values()].find((n) => !isPriced(n))!;
    expect(buyerPricePerMb(s, { kind: "reseller", resellerId: "r1" }, unpriced, null)).toBeNull();
  });

  it("holds: plan data × the buyer's highest zone price, or the override", () => {
    const it3 = s.plans.find((p) => p.id === "p-it3")!;
    const max = Math.max(...zoneNetworks(it3.zoneId).map((n) => n.costPerMb!));
    expect(holdFor(s, it3, { kind: "reseller", resellerId: "r2" })).toBeCloseTo(3072 * max * 1.15, 1);
    const world = s.plans.find((p) => p.id === "p-world10")!;
    expect(holdFor(s, world, { kind: "reseller", resellerId: "r2" })).toBe(150);
  });
});
