import { apiFetch } from "./client";
import type { EsimsApi } from "./esims.demo";
import type { Esim, EsimActivity, EsimCredentials, EsimDetail, Order, Page, SellResult, UsageByNetwork, UsagePoint } from "@/lib/platform/types";

const idem = (key: string) => ({ "Idempotency-Key": key });

export const httpEsims: EsimsApi = {
  listEsims: (f = {}) => apiFetch<Page<Esim>>("/esims", { query: { ...f, status: f.status === "SUSPENDED_ANY" ? "SUSPENDED" : f.status } }),
  getEsim: (id) => apiFetch<EsimDetail>(`/esims/${id}`),
  getEsimCredentials: (id) => apiFetch<EsimCredentials>(`/esims/${id}/credentials`),
  getEsimActivity: (id) => apiFetch<Page<EsimActivity>>(`/esims/${id}/activity`, { query: { pageSize: 100 } }).then((p) => p.data),
  getEsimUsage: (id, period) =>
    Promise.all([
      apiFetch<UsagePoint[]>(`/esims/${id}/usage`, { query: { ...period, granularity: "day" } }),
      apiFetch<Page<{ lines: UsageByNetwork[] }>>("/usage/charges", { query: { esimId: id, ...period } }).then((p) => p.data.flatMap((d) => d.lines)),
    ]).then(([daily, byNetwork]) => ({ daily, byNetwork })),
  suspendEsim: (id, input = {}) => apiFetch<void>(`/esims/${id}/suspend`, { method: "POST", body: input }),
  reactivateEsim: (id, input = {}) => apiFetch<void>(`/esims/${id}/reactivate`, { method: "POST", body: input }),
  setEndOfLife: (id, input) => apiFetch<void>(`/esims/${id}/status`, { method: "PATCH", body: { status: "END_OF_LIFE", ...input } }),
  extendPackage: (esimId, packageId, input) => apiFetch<void>(`/esims/${esimId}/packages/${packageId}/extend`, { method: "POST", body: { newValidityDays: input.days, reason: input.reason } }),
  addPackageData: (esimId, packageId, input) => apiFetch<void>(`/esims/${esimId}/packages/${packageId}/limits`, { method: "POST", body: input }),
  setPackageBlocked: (esimId, packageId, input) => apiFetch<void>(`/esims/${esimId}/packages/${packageId}/${input.blocked ? "block" : "unblock"}`, { method: "POST", body: { reason: input.reason } }),
  deletePackage: (esimId, packageId, input) => apiFetch<void>(`/esims/${esimId}/packages/${packageId}`, { method: "DELETE", body: { confirm: true, ...input } }),
  setEsimCustomer: (id, customerId) => apiFetch<void>(`/esims/${id}/customer`, { method: "PATCH", body: { customerId } }),
  emailEsimQr: (id, email) => apiFetch<void>(`/esims/${id}/qr/email`, { method: "POST", body: { email } }).then(() => email),
  createEsimOrder: (input, key) => apiFetch<SellResult>("/orders/esim", { method: "POST", body: input, headers: idem(key) }),
  addPlanToEsim: (esimId, input, key) => apiFetch<SellResult>(`/esims/${esimId}/plans`, { method: "POST", body: input, headers: idem(key) }),
  getSellContext: (planId) =>
    apiFetch<{ hold: string }>("/pricing/preview", { query: { planId } }).then(async (p) => {
      const w = await apiFetch<{ available: string; outstanding?: string } | null>("/dashboard/wallets");
      const avail = Number(w?.available ?? 0);
      const hold = Number(p.hold);
      return {
        hold: p.hold,
        available: w?.available ?? "0",
        after: String(Math.max(0, avail - hold)),
        enough: avail >= hold,
        outstanding: w?.outstanding ?? "0",
        dailyLimitReached: false,
        direct: false,
        walletName: "Your wallet",
      };
    }),
  listOrders: (f = {}) => apiFetch<Page<Order>>("/orders", { query: { ...f, pageSize: 100 } }).then((p) => p.data),
  getOrder: (id) => apiFetch<Order>(`/orders/${id}`),
  checkOrder: (id) => apiFetch<{ matched: boolean; candidates: string[] }>(`/orders/${id}/check`, { method: "POST" }),
  resolveOrder: (id, input) => apiFetch<void>(`/orders/${id}/resolve`, { method: "POST", body: input }),
  cancelOrder: (id) => apiFetch<void>(`/orders/${id}/cancel`, { method: "POST" }),
};
