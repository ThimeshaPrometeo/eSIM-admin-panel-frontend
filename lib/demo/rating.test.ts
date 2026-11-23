import { describe, expect, it } from "vitest";
import { addDays, dateInZone } from "@/lib/platform/dates";
import { costAt, discountAt, forEachPackageDay, markupAt, packageCharges, round2 } from "./rating";
import { createSeed } from "./seed";

const s = createSeed(new Date("2026-11-23T06:00:00Z"));
const today = s.seededOn;

describe("rating: one formula everywhere", () => {
  it("every line is Yesim €/MB × (1 + markup) × (1 − discount)", () => {
    let n = 0;
    forEachPackageDay(s, (_p, _d, lines, _c, owner) => {
      for (const l of lines) {
        n++;
        const resellerPrice = l.costPerMb * (1 + l.markupPercent / 100) * (1 - l.discountPercent / 100);
        expect(l.revenue).toBeCloseTo(l.mb * resellerPrice, 9);
        expect(l.amount).toBeCloseTo(owner === null ? l.cost : l.revenue, 9);
        expect(l.revenue - l.cost).toBeCloseTo(l.markupAmount - l.discountAmount, 9);
      }
    });
    expect(n).toBeGreaterThan(1000);
  });

  it("wallet ledgers equal the rated charges to the cent (minus what was never covered)", () => {
    const rated = new Map<string, number>();
    forEachPackageDay(s, (_p, _d, _l, charge, owner) => rated.set(owner ?? "house", round2((rated.get(owner ?? "house") ?? 0) + charge)));
    for (const w of s.wallets) {
      const ledger = round2(-s.ledger.filter((l) => l.walletId === w.id && l.type === "usage_charge").reduce((a, l) => a + l.amount, 0));
      expect(ledger, w.id).toBeCloseTo(round2((rated.get(w.resellerId ?? "house") ?? 0) - w.outstanding), 2);
    }
  });

  it("holds have used exactly their plan's charges", () => {
    for (const p of s.packages) {
      const h = s.holds.find((x) => x.id === p.holdId)!;
      const c = packageCharges(s, p);
      expect(c.final + c.estimated).toBeCloseTo(p.chargedFinal + p.chargedEstimated, 2);
      if (h.status !== "exhausted" && h.status !== "waiting") expect(h.used).toBeCloseTo(c.final + c.estimated, 2);
    }
  });

  it("uses the Yesim price and markup in force on the day", () => {
    const v14 = s.priceVersions.find((v) => v.version === 14)!;
    const ch = v14.changes[0]!;
    expect(costAt(s, ch.networkId, addDays(v14.effectiveFrom, -1))).toBe(ch.oldCost);
    expect(costAt(s, ch.networkId, v14.effectiveFrom)).toBe(ch.newCost);
    expect(markupAt(s, "r3", addDays(today, -21))).toBe(35);
    expect(markupAt(s, "r3", addDays(today, -20))).toBe(40);
    expect(discountAt(s, "r1", "p-it3", addDays(today, -61))).toBe(5); // plan discount started 60 days ago
    expect(discountAt(s, "r1", "p-it3", addDays(today, -60))).toBe(10);
  });

  it("has price rises and falls inside the last 90 days, and two markup changes", () => {
    const recent = s.priceVersions.filter((v) => v.effectiveFrom >= addDays(today, -90)).flatMap((v) => v.changes);
    expect(recent.some((c) => c.newCost > c.oldCost)).toBe(true);
    expect(recent.some((c) => c.newCost < c.oldCost)).toBe(true);
    expect(s.markupHistory.filter((m) => m.previousPercent !== null).length).toBe(2);
  });

  it("no markup applies before it was set", () => {
    for (const m of s.markupHistory) expect(m.effectiveFrom >= dateInZone(new Date(m.changedAt)), m.id).toBe(true);
  });
});
