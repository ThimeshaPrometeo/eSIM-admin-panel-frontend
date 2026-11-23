import { apiFetch } from "./client";
import type { CatalogueApi } from "./catalogue.demo";
import type { CatalogueItem, CoverageCountry, CoverageCountryDetail, Discount, Page, Plan, PlanDetail, PlanPricingPreview, PriceList, ResellerPlan, Zone } from "@/lib/platform/types";

const list = <T,>(path: string, query?: Record<string, string | number | boolean | null | undefined>) => apiFetch<Page<T> | T[]>(path, { query: { pageSize: 100, ...query } }).then((r) => (Array.isArray(r) ? r : r.data));

export const httpCatalogue: CatalogueApi = {
  listCoverageCountries: (f = {}) => list<CoverageCountry>("/coverage/countries", { q: f.q, zoneId: f.zoneId, planId: f.planId, tech: f.tech }),
  getCoverageCountry: (iso2) => apiFetch<CoverageCountryDetail>(`/coverage/countries/${iso2}`),
  listZones: () => list<Zone>("/coverage/zones"),
  getCurrentPriceList: (o = {}) => apiFetch<PriceList>("/price-lists/current", { query: { format: "json", resellerId: o.resellerId } }),
  syncPriceList: () => apiFetch<{ status: "unchanged"; at: string }>("/price-lists/sync", { method: "POST" }),
  listPlans: (f = {}) => list<Plan>("/plans", { q: f.q, status: f.status, zoneId: f.zoneId }),
  getPlan: (id) => apiFetch<PlanDetail>(`/plans/${id}`),
  pricingPreview: (input) => apiFetch<PlanPricingPreview>("/plans/pricing-preview", { method: "POST", body: input }),
  createPlan: (input) => apiFetch<Plan>("/plans", { method: "POST", body: input }),
  updatePlan: (id, input) => apiFetch<Plan>(`/plans/${id}`, { method: "PATCH", body: input }),
  listPlansCatalogue: (f = {}) => list<CatalogueItem>("/plans/catalogue", { q: f.q, country: f.country }),
  listResellerPlans: () => list<ResellerPlan>("/reseller-plans"),
  createResellerPlan: (input) => apiFetch<{ id: string }>("/reseller-plans", { method: "POST", body: input }).then((r) => r.id),
  updateResellerPlan: (id, input) => apiFetch<void>(`/reseller-plans/${id}`, { method: "PATCH", body: input }),
  deleteResellerPlan: (id) => apiFetch<void>(`/reseller-plans/${id}`, { method: "DELETE" }),
  listDiscounts: () => list<Discount>("/discounts"),
  createDiscount: (input) => apiFetch<void>("/discounts", { method: "POST", body: input }),
  updateDiscount: (id, input) => apiFetch<void>(`/discounts/${id}`, { method: "PATCH", body: input }),
  deleteDiscount: (id) => apiFetch<void>(`/discounts/${id}`, { method: "DELETE" }),
  discountPreview: (input) =>
    apiFetch<{ network: string; beforePerGb: number; afterPerGb: number; currentPercent: number }>("/pricing/preview", { query: { resellerId: input.resellerId, planId: input.planId, percent: input.percent } }),
};
