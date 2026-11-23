/**
 * Demo dashboard (spec 8.1): every chart in the viewer's scope and period,
 * estimated amounts marked. Revenue and profit need `profit_reports`.
 */
import { NETWORK_BY_ID } from "@/lib/demo/catalogue";
import { esimView, isLivePlan, walletOfReseller, walletSummary } from "@/lib/demo/derive";
import { forEachPackageDay } from "@/lib/demo/rating";
import { read } from "@/lib/demo/run";
import { authorize } from "@/lib/demo/session";
import { addDays, dateInZone } from "@/lib/platform/dates";
import { can } from "@/lib/platform/permissions";
import { bucketOf, bucketsIn, previousPeriod, type Period } from "@/lib/platform/period";
import { money } from "@/lib/platform/money";
import type { DashboardData } from "@/lib/platform/types";

const MB = 1048576;

export const demoDashboard = {
  getDashboard: (period: Pick<Period, "from" | "to" | "granularity">, opts: { resellerId?: string | null } = {}) =>
    read((): DashboardData => {
      const c = authorize("dashboard");
      const s = c.s;
      const today = s.seededOn;
      const scopeReseller = c.tenant ? (opts.resellerId ?? undefined) : c.resellerId;
      const inScope = (resellerId: string | null) => (scopeReseller === undefined ? true : resellerId === scopeReseller);
      const esims = s.esims.filter((e) => inScope(e.resellerId));
      const esimIds = new Set(esims.map((e) => e.id));
      const pkgs = s.packages.filter((p) => esimIds.has(p.esimId));
      const esimOf = new Map(esims.map((e) => [e.id, e]));
      const showRevenue = can(c.me.permissions, "profit_reports");
      const buckets = bucketsIn(period);
      const prev = previousPeriod({ ...period, preset: "custom" });

      const usage = new Map(buckets.map((b) => [b, { finalBytes: 0, estimatedBytes: 0 }]));
      const revenue = new Map(buckets.map((b) => [b, { revenue: 0, cost: 0 }]));
      const byEsim = new Map<string, number>();
      const byCountry = new Map<string, number>();
      const recent = new Map<string, number>();
      let used = 0;
      let usedPrev = 0;
      let revenueTotal = 0;
      let revenuePrev = 0;

      // every figure from the rated usage lines (lib/demo/rating): revenue = reseller charges, or retail for direct sales
      const pkgIds = new Set(pkgs.map((p) => p.id));
      forEachPackageDay(
        s,
        (p, day, lines, charge, owner) => {
          const bytes = lines.reduce((a, l) => a + l.mb, 0) * MB;
          const revenueDay = owner === null ? lines.reduce((a, l) => a + l.revenue, 0) : charge;
          const costDay = lines.reduce((a, l) => a + l.cost, 0);
          const iso = lines[0]!.iso2;
          if (day >= addDays(today, -6)) recent.set(iso, (recent.get(iso) ?? 0) + bytes);
          if (day >= prev.from && day <= prev.to) {
            usedPrev += bytes;
            revenuePrev += revenueDay;
          }
          if (day < period.from || day > period.to) return;
          const b = bucketOf(day, period.granularity);
          const slot = usage.get(b)!;
          if (lines[0]!.estimated) slot.estimatedBytes += bytes;
          else slot.finalBytes += bytes;
          used += bytes;
          byEsim.set(p.esimId, (byEsim.get(p.esimId) ?? 0) + bytes);
          for (const l of lines) byCountry.set(l.iso2, (byCountry.get(l.iso2) ?? 0) + l.mb * MB);
          const r = revenue.get(b)!;
          r.revenue += revenueDay;
          r.cost += costDay;
          revenueTotal += revenueDay;
        },
        { packages: (p) => pkgIds.has(p.id) },
      );

      // monthly usage: the months touched by the last 90 days
      const monthly = new Map<string, number>();
      for (const p of pkgs) {
        const u = s.usage[p.id];
        if (!u) continue;
        u.mb.forEach((mb, i) => {
          const m = addDays(u.start, i).slice(0, 7);
          monthly.set(m, (monthly.get(m) ?? 0) + mb * MB);
        });
      }

      const views = esims.map((e) => esimView(s, e));
      const active = views.filter((v) => v.status === "ACTIVE" && v.plans.some((p) => p.state === "active")).length;
      const suspended = views.filter((v) => v.status === "SUSPENDED").length;
      const pending = views.filter((v) => v.status === "ACTIVE" && !v.plans.some((p) => p.state === "active") && v.plans.some((p) => isLivePlan(p.state))).length;
      const expired = views.length - active - suspended - pending;
      const status: DashboardData["status"] = [
        { key: "active", count: active },
        { key: "pending", count: pending },
        { key: "suspended", count: suspended },
        { key: "expired", count: expired },
        ...(c.tenant ? [{ key: "in_stock" as const, count: s.settings.freeStock }] : []),
      ];

      const sold = new Map<string, number>();
      for (const o of s.orders)
        if ((o.status === "completed" || o.status === "awaiting_funds") && inScope(o.resellerId) && o.createdAt.slice(0, 10) >= period.from && o.createdAt.slice(0, 10) <= period.to) {
          const name = s.plans.find((p) => p.id === o.planId)?.name ?? "";
          sold.set(name, (sold.get(name) ?? 0) + 1);
        }

      const walletIds = new Set(s.wallets.filter((w) => inScope(w.resellerId) && (c.tenant || w.kind === "reseller")).map((w) => w.id));
      const tx = new Map(buckets.map((b) => [b, { credits: 0, debits: 0 }]));
      for (const l of s.ledger) {
        if (!walletIds.has(l.walletId) || l.type === "hold" || l.type === "hold_release") continue;
        const day = dateInZone(new Date(l.createdAt));
        if (day < period.from || day > period.to) continue;
        const slot = tx.get(bucketOf(day, period.granularity));
        if (!slot) continue;
        if (l.amount > 0) slot.credits += l.amount;
        else slot.debits += -l.amount;
      }

      const ownWallet = c.resellerId ? walletSummary(s, walletOfReseller(s, c.resellerId)) : null;
      const activePrev = active; // active count is a point in time

      return {
        stats: {
          totalEsims: views.length,
          activeEsims: active,
          dataUsedBytes: used,
          available: ownWallet?.available ?? null,
          revenue: showRevenue ? money(revenueTotal) : null,
          previous: { activeEsims: activePrev, dataUsedBytes: usedPrev, revenue: showRevenue ? money(revenuePrev) : null },
        },
        usage: buckets.map((b) => ({ bucket: b, ...usage.get(b)! })),
        monthly: [...monthly.entries()].sort().map(([month, bytes]) => ({ month, bytes })),
        status,
        plansSold: [...sold.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        transactions: buckets.map((b) => ({ bucket: b, credits: Math.round(tx.get(b)!.credits * 100) / 100, debits: Math.round(tx.get(b)!.debits * 100) / 100 })),
        topEsims: [...byEsim.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([id, bytes]) => ({ id, iccid: esimOf.get(id)!.iccid, bytes })),
        byCountry: [...byCountry.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([iso2, bytes]) => ({ iso2, country: [...NETWORK_BY_ID.values()].find((n) => n.iso2 === iso2)?.country ?? iso2, bytes })),
        revenue: showRevenue ? buckets.map((b) => ({ bucket: b, revenue: Math.round(revenue.get(b)!.revenue * 100) / 100, cost: Math.round(revenue.get(b)!.cost * 100) / 100, profit: Math.round((revenue.get(b)!.revenue - revenue.get(b)!.cost) * 100) / 100 })) : null,
        recentCountries: [...recent.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([iso]) => iso),
      };
    }),
};

export type DashboardApi = typeof demoDashboard;
