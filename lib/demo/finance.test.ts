import { beforeEach, describe, expect, it } from "vitest";
import { demoFinance } from "@/lib/api/finance.demo";
import { demoPeople } from "@/lib/api/people.demo";
import { addDays } from "@/lib/platform/dates";
import { round2 } from "./rating";
import { createSeed } from "./seed";
import { __setLatency, __setState, db } from "./store";

beforeEach(() => {
  __setLatency(false);
  __setState(createSeed(new Date("2026-11-23T06:00:00Z")));
  db().session = { userId: "u-admin", pendingMfaUserId: null };
});

const ledgerUsage = (walletId: string, from: string, to: string) =>
  round2(-db().ledger.filter((l) => l.walletId === walletId && l.type === "usage_charge" && l.reference.slice(3) >= from && l.reference.slice(3) <= to).reduce((a, l) => a + l.amount, 0));

describe("financial figures agree across pages", () => {
  it("statements = ledger usage charges for the month, to the cent", async () => {
    const docs = await demoFinance.listInvoices({ kind: "statement" });
    expect(docs.length).toBeGreaterThan(6);
    for (const d of docs.slice(0, 8)) {
      const detail = await demoFinance.getInvoice(d.id);
      const from = `${d.period}-01`;
      const to = addDays(`${new Date(Date.UTC(Number(d.period!.slice(0, 4)), Number(d.period!.slice(5, 7)), 1)).toISOString().slice(0, 10)}`, -1);
      expect(detail.totals.usage, d.number).toBeCloseTo(ledgerUsage(`w-${d.resellerId}`, from, to), 2);
      expect(Number(d.amount)).toBeCloseTo(detail.totals.usage, 2);
      const t = detail.totals;
      expect(round2(t.opening + t.topups - t.usage + t.other), d.number).toBeCloseTo(t.closing, 2);
      expect(t.other, d.number).toBeCloseTo(0, 2);
    }
  });

  it("profit report revenue per reseller = wallet usage charges (+ what was never covered)", async () => {
    const s = db();
    const r = await demoFinance.getProfitReport({ from: addDays(s.seededOn, -120), to: s.seededOn, granularity: "month" });
    for (const row of r.byReseller.filter((x) => x.key !== "direct")) {
      const w = s.wallets.find((x) => x.resellerId === row.key)!;
      expect(row.revenue, row.label).toBeCloseTo(ledgerUsage(w.id, "0000", "9999") + w.outstanding, 1);
    }
    const wf = r.waterfall;
    expect(round2(wf.cost + wf.markup - wf.discount)).toBeCloseTo(wf.revenue, 2);
    expect(round2(wf.revenue - wf.cost)).toBeCloseTo(wf.profit, 2);
    expect(r.totals.revenue).toBeCloseTo(r.series.reduce((a, x) => a + x.revenue, 0), 1);
  });

  it("simulator and price breakdown use the same formula", async () => {
    const b = await demoFinance.getPriceBreakdown(["r1"]);
    const row = b.rows.find((x) => x.iso2 === "IT" && x.costPerMb !== null)!;
    const sim = await demoFinance.simulate({ resellerId: "r1", networkId: row.id, bytes: 1024 ** 3 });
    const line = sim.lines[0]!;
    expect(line.price).toBeCloseTo(row.cells[0]!.pricePerMb! * 1024, 9);
    expect(line.price).toBeCloseTo(row.costPerMb! * 1024 * 1.25 * 0.95, 9);
    expect(line.profit).toBeCloseTo(row.cells[0]!.profitPerGb!, 9);
  });

  it("resellers see their charge without Yesim cost or markup", async () => {
    db().session = { userId: "u-r1", pendingMfaUserId: null };
    const p = db().packages.find((x) => db().usage[x.id] && db().esims.find((e) => e.id === x.esimId)?.resellerId === "r1")!;
    const c = await demoFinance.getChargeBreakdown({ packageId: p.id });
    expect(c.viewer).toBe("reseller");
    expect(c.lines.every((l) => l.costPerMb === null && l.markupPercent === null && l.profit === null)).toBe(true);
    expect(c.total).toBeCloseTo(p.chargedFinal + p.chargedEstimated, 2);
  });

  it("a markup change shows in the price at once and never reprices past charges", async () => {
    const before = await demoFinance.getPriceBreakdown(["r1"]);
    const ledgerBefore = ledgerUsage("w-r1", "0000", "9999");
    const docs = await demoFinance.listInvoices({ kind: "statement", resellerId: "r1" });
    const stBefore = (await demoFinance.getInvoice(docs[0]!.id)).totals.usage;
    await demoPeople.setResellerMarkup("r1", { markupPercent: 30, reason: "Demo" });
    const after = await demoFinance.getPriceBreakdown(["r1"]);
    const row = (b: typeof before) => b.rows.find((x) => x.iso2 === "IT" && x.costPerMb !== null)!.cells[0]!.pricePerMb!;
    expect(row(after) / row(before)).toBeCloseTo(1.3 / 1.25, 9);
    expect(ledgerUsage("w-r1", "0000", "9999")).toBeCloseTo(ledgerBefore, 2);
    expect((await demoFinance.getInvoice(docs[0]!.id)).totals.usage).toBeCloseTo(stBefore, 2);
    expect((await demoFinance.listMarkupHistory("r1")).some((m) => m.previousPercent === 25 && m.markupPercent === 30 && m.effectiveFrom === addDays(db().seededOn, 1))).toBe(true);
  });
});
