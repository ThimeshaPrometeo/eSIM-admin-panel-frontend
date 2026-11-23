import { apiFetch } from "./client";
import type { OperationsApi } from "./operations.demo";
import type { Alert, AlertRule, Customer, CustomerDetail, Inventory, Page, SupplierStatus, UsageReport } from "@/lib/platform/types";

/** Endpoints for the operations pages; the ones the backend doesn't have yet are listed in backend-backlog.md (BB-21 to BB-25). */
export const httpOperations: OperationsApi = {
  getUsageReport: (period, f = {}) =>
    apiFetch<UsageReport>("/reports/usage", { query: { from: period.from, to: period.to, granularity: period.granularity, resellerId: f.resellerId, planId: f.planId, iso2: f.iso2 } }),
  getInventory: () => apiFetch<Inventory>("/inventory"),
  listAlerts: (f = {}) => apiFetch<Page<Alert>>("/alerts", { query: { status: f.status, type: f.type, resellerId: f.resellerId, pageSize: 100 } }).then((p) => p.data),
  setAlertStatus: (id, status) => apiFetch<Alert>(`/alerts/${id}`, { method: "PATCH", body: { status } }),
  listAlertRules: () => apiFetch<Page<AlertRule>>("/alert-rules").then((p) => p.data),
  createAlertRule: (input) => apiFetch<AlertRule>("/alert-rules", { method: "POST", body: input }),
  updateAlertRule: (id, input) => apiFetch<AlertRule>(`/alert-rules/${id}`, { method: "PATCH", body: input }),
  deleteAlertRule: (id) => apiFetch<void>(`/alert-rules/${id}`, { method: "DELETE" }),
  getCustomer: (id) => apiFetch<CustomerDetail>(`/customers/${id}`),
  updateCustomer: (id, input) => apiFetch<Customer>(`/customers/${id}`, { method: "PATCH", body: input }),
  getSupplierStatus: () => apiFetch<SupplierStatus>("/yesim/status"),
  runSupplierJob: (id) => apiFetch<{ status: "unchanged"; at: string }>(`/yesim/jobs/${id}/run`, { method: "POST" }),
};
