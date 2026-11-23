import { apiFetch } from "./client";
import type { WalletsApi } from "./wallets.demo";
import type { LedgerEntry, Page, TopupRequest, Wallet, WalletHold } from "@/lib/platform/types";

const list = <T,>(path: string, query?: Record<string, string | number | boolean | null | undefined>) => apiFetch<Page<T>>(path, { query: { pageSize: 100, ...query } }).then((r) => r.data);

export const httpWallets: WalletsApi = {
  listWallets: () => list<Wallet>("/wallets"),
  getWallet: (id) => apiFetch<Wallet>(`/wallets/${id}`),
  getMyWallet: () => list<Wallet>("/wallets").then((ws) => ws[0]!),
  listWalletHolds: (id, status) => list<WalletHold>(`/wallets/${id}/holds`, { status: status === "live" ? undefined : status }),
  createWalletAdjustment: (id, input) =>
    apiFetch<{ outstandingPaid: number; plansFunded: number }>(`/wallets/${id}/adjustments`, {
      method: "POST",
      body: { type: "adjustment", amount: input.direction === "debit" ? -input.amount : input.amount, description: input.description },
    }),
  listTransactions: (f = {}) => apiFetch<Page<LedgerEntry>>("/transactions", { query: { ...f } }),
  listTopupRequests: (f = {}) => list<TopupRequest>("/topup-requests", { status: f.status }),
  createTopupRequest: (input) => apiFetch<TopupRequest>("/topup-requests", { method: "POST", body: input }),
  approveTopupRequest: (id) => apiFetch<TopupRequest>(`/topup-requests/${id}/approve`, { method: "POST" }),
  rejectTopupRequest: (id, input) => apiFetch<void>(`/topup-requests/${id}/reject`, { method: "POST", body: input }),
  cancelTopupRequest: (id) => apiFetch<void>(`/topup-requests/${id}/cancel`, { method: "POST" }),
};
