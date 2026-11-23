import { apiFetch } from "./client";
import type { PeopleApi } from "./people.demo";
import type { Assistant, AuditEntry, Customer, DocumentRow, Page, PermissionContext, Reseller } from "@/lib/platform/types";

const list = <T,>(path: string, query?: Record<string, string | number | boolean | null | undefined>) => apiFetch<Page<T>>(path, { query: { pageSize: 100, ...query } }).then((r) => r.data);

export const httpPeople: PeopleApi = {
  listResellers: (f = {}) => list<Reseller>("/resellers", { q: f.q, status: f.status }),
  listResellerOptions: () => list<Reseller>("/resellers").then((rs) => rs.map((r) => ({ id: r.id, name: r.companyName, status: r.status }))),
  getReseller: (id) => apiFetch<Reseller>(`/resellers/${id}`),
  createReseller: (input) => apiFetch<Reseller>("/resellers", { method: "POST", body: input }),
  updateReseller: (id, input) => apiFetch<void>(`/resellers/${id}`, { method: "PATCH", body: input }),
  setResellerStatus: (id, input) => apiFetch<void>(`/resellers/${id}/status`, { method: "PATCH", body: input }),
  setResellerMarkup: (id, input) => apiFetch<void>(`/resellers/${id}/markup`, { method: "PATCH", body: input }),
  adjustResellerWallet: (id, input) =>
    apiFetch<{ id: string }>(`/wallets`, { query: { resellerId: id } }).then((w) =>
      apiFetch<{ outstandingPaid: number; plansFunded: number }>(`/wallets/${w.id}/adjustments`, {
        method: "POST",
        body: { type: "adjustment", amount: input.direction === "debit" ? -input.amount : input.amount, description: input.description },
      }),
    ),
  listResellerAudit: (id) => list<AuditEntry>("/audit-logs", { entityType: "reseller", entityId: id }),
  listResellerDocuments: (id) => list<DocumentRow>("/invoices", { resellerId: id }),
  listCustomers: (f = {}) => list<Customer>("/customers", { q: f.q, resellerId: f.resellerId }),
  createCustomer: (input) => apiFetch<Customer>("/customers", { method: "POST", body: input }),
  listAssistants: (f = {}) => list<Assistant>("/assistants", { resellerId: f.resellerId }),
  getPermissionContext: () =>
    apiFetch<{ effective: Record<string, string>; envelopes?: { role?: Record<string, string> } }>("/permissions/modules").then((r) => ({
      envelope: (r.envelopes?.role ?? r.effective) as PermissionContext["envelope"],
      resellerName: null,
    })),
  createAssistant: (input) => apiFetch<Assistant>("/assistants", { method: "POST", body: { ...input, permissions: input.grants } }),
  setAssistantPermissions: (id, grants) => apiFetch<void>(`/assistants/${id}/permissions`, { method: "PUT", body: { permissions: grants } }),
  updateAssistant: (id, input) => apiFetch<void>(`/assistants/${id}`, { method: "PATCH", body: input }),
  setAssistantStatus: (id, input) => apiFetch<void>(`/assistants/${id}/status`, { method: "PATCH", body: input }),
};
