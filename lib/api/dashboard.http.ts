import { apiFetch } from "./client";
import type { DashboardApi } from "./dashboard.demo";
import type { DashboardData } from "@/lib/platform/types";

/** The backend serves each chart separately (`/dashboard/*`); this assembles them into one view model. */
export const httpDashboard: DashboardApi = {
  getDashboard: async (period, opts = {}) => {
    const q = { from: period.from, to: period.to, granularity: period.granularity, resellerId: opts.resellerId };
    const get = <T,>(path: string) => apiFetch<T>(path, { query: q });
    const [usage, monthly, status, plansSold, transactions, topEsims, byCountry, wallets, revenue] = await Promise.all([
      get<DashboardData["usage"]>("/dashboard/usage/daily"),
      get<DashboardData["monthly"]>("/dashboard/usage/monthly"),
      get<DashboardData["status"]>("/dashboard/esims/status"),
      get<DashboardData["plansSold"]>("/dashboard/plans/sold"),
      get<DashboardData["transactions"]>("/dashboard/transactions"),
      get<DashboardData["topEsims"]>("/dashboard/esims/top"),
      get<DashboardData["byCountry"]>("/dashboard/usage/by-country"),
      get<{ available: string } | null>("/dashboard/wallets").catch(() => null),
      get<DashboardData["revenue"]>("/dashboard/revenue").catch(() => null),
    ]);
    const active = status.find((x) => x.key === "active")?.count ?? 0;
    const used = usage.reduce((a, u) => a + u.finalBytes + u.estimatedBytes, 0);
    return {
      stats: {
        totalEsims: status.filter((x) => x.key !== "in_stock").reduce((a, x) => a + x.count, 0),
        activeEsims: active,
        dataUsedBytes: used,
        available: wallets?.available ?? null,
        revenue: revenue ? String(revenue.reduce((a, r) => a + r.revenue, 0)) : null,
        previous: { activeEsims: active, dataUsedBytes: used, revenue: null },
      },
      usage,
      monthly,
      status,
      plansSold,
      transactions,
      topEsims,
      byCountry,
      revenue,
      recentCountries: byCountry.slice(0, 8).map((c) => c.iso2),
    };
  },
};
