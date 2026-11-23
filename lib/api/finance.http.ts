import { apiFetch } from "./client";
import type { FinanceApi } from "./finance.demo";
import type { ChargeBreakdown, InvoiceDetail, InvoiceSummary, MarkupChange, Page, PriceBreakdown, PriceChange, PriceVersion, ProfitReport, Simulation, TenantSettings } from "@/lib/platform/types";

/** Endpoints for the financial pages; the ones the backend doesn't have yet are listed in backend-backlog.md (BB-16 to BB-20). */
export const httpFinance: FinanceApi = {
  getPriceBreakdown: (resellerIds) => apiFetch<PriceBreakdown>("/price-lists/breakdown", { query: { resellerIds: resellerIds.join(",") } }),
  simulate: (input) => apiFetch<Simulation>("/pricing/simulate", { method: "POST", body: input }),
  getChargeBreakdown: (q) => apiFetch<ChargeBreakdown>("/usage/charges/breakdown", { query: q as Record<string, string> }),
  getProfitReport: (period, opts = {}) => apiFetch<ProfitReport>("/reports/profit", { query: { from: period.from, to: period.to, granularity: period.granularity, resellerId: opts.resellerId } }),
  listPriceVersions: () => apiFetch<Page<PriceVersion>>("/price-lists/versions").then((p) => p.data),
  getPriceChanges: (version) => apiFetch<PriceChange[]>(`/price-lists/versions/${version}/changes`),
  listMarkupHistory: (resellerId) => apiFetch<Page<MarkupChange>>("/resellers/markup-history", { query: { resellerId } }).then((p) => p.data),
  listInvoices: (f = {}) => apiFetch<Page<InvoiceSummary>>("/invoices", { query: { kind: f.kind, resellerId: f.resellerId, pageSize: 100 } }).then((p) => p.data),
  getInvoice: (id) => apiFetch<InvoiceDetail>(`/invoices/${id}`),
  getSettings: () => apiFetch<TenantSettings>("/settings"),
  updateSettings: (input) => apiFetch<TenantSettings>("/settings", { method: "PATCH", body: input }),
};
