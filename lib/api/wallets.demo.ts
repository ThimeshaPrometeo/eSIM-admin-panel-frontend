/**
 * Demo wallets, holds, transactions and top-up requests (spec 8.18–8.21).
 * Approving a top-up credits the wallet, pays any outstanding amount first,
 * issues a receipt and runs the funding queue (waiting plans unblock).
 */
import { ApiError } from "./errors";
import { creditWallet, debitWallet } from "@/lib/demo/billing";
import { walletName, walletOfReseller, walletView } from "@/lib/demo/derive";
import type { DState } from "@/lib/demo/model";
import { read, write } from "@/lib/demo/run";
import { assertScope, audit, authorize, notify, nowIso, paginate, requireRole, resellerAudience, tenantAudience, type Caller } from "@/lib/demo/session";
import { formatMoney, money } from "@/lib/platform/money";
import type { LedgerEntry, LedgerType, Page, TopupRequest, Wallet, WalletHold } from "@/lib/platform/types";

export type TransactionFilters = {
  walletId?: string | null;
  resellerId?: string | null;
  type?: LedgerType | null;
  from?: string | null;
  to?: string | null;
  page?: number;
  pageSize?: number;
};

function findWallet(c: Caller, id: string) {
  const w = c.s.wallets.find((x) => x.id === id);
  if (!w) throw new ApiError(404, "NOT_FOUND");
  assertScope(c, w.resellerId);
  if (!c.tenant && w.kind === "house") throw new ApiError(404, "NOT_FOUND");
  return w;
}

function holdView(s: DState, h: DState["holds"][number], queue: string[]): WalletHold {
  const pkg = s.packages.find((p) => p.id === h.packageId);
  const esim = s.esims.find((e) => e.id === h.esimId);
  const pos = queue.indexOf(h.id);
  return {
    id: h.id,
    walletId: h.walletId,
    esimId: h.esimId,
    iccid: esim?.iccid ?? "",
    orderId: h.orderId,
    planName: pkg?.name ?? "",
    amount: money(h.amount),
    used: money(h.used),
    status: h.status,
    queuePosition: pos >= 0 ? pos + 1 : null,
    createdAt: h.createdAt,
  };
}

function topupView(s: DState, t: DState["topups"][number]): TopupRequest {
  const name = (id: string | null) => (id ? (s.users.find((u) => u.id === id)?.fullName ?? null) : null);
  return {
    id: t.id,
    resellerId: t.resellerId,
    resellerName: s.resellers.find((r) => r.id === t.resellerId)?.companyName ?? "",
    walletId: t.walletId,
    amount: money(t.amount),
    paymentReference: t.paymentReference,
    note: t.note,
    status: t.status,
    requestedBy: name(t.requestedBy) ?? "",
    createdAt: t.createdAt,
    decidedAt: t.decidedAt,
    decidedBy: name(t.decidedBy),
    decisionNote: t.decisionNote,
    receiptNumber: t.receiptNumber,
    effect: t.status === "approved" && t.outstandingPaid !== null ? { outstandingPaid: money(t.outstandingPaid), plansFunded: t.plansFunded ?? 0 } : null,
  };
}

let receiptSeq = 100;

export const demoWallets = {
  listWallets: () =>
    read((): Wallet[] => {
      const c = authorize("wallets");
      return c.s.wallets.filter((w) => (c.tenant ? true : w.resellerId === c.resellerId)).map((w) => walletView(c.s, w));
    }),
  getWallet: (id: string) =>
    read((): Wallet => {
      const c = authorize("wallets");
      return walletView(c.s, findWallet(c, id));
    }),
  /** The signed-in reseller's (or assistant's reseller's) wallet. */
  getMyWallet: () =>
    read((): Wallet => {
      const c = authorize("wallets");
      if (!c.resellerId) throw new ApiError(404, "NOT_FOUND");
      return walletView(c.s, walletOfReseller(c.s, c.resellerId));
    }),
  listWalletHolds: (id: string, status?: WalletHold["status"] | "live" | null) =>
    read((): WalletHold[] => {
      const c = authorize("wallets");
      const w = findWallet(c, id);
      const all = c.s.holds.filter((h) => h.walletId === w.id);
      const queue = all.filter((h) => h.status === "waiting").sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((h) => h.id);
      return all
        .filter((h) => (status === "live" ? ["waiting", "active", "exhausted"].includes(h.status) : !status || h.status === status))
        .map((h) => holdView(c.s, h, queue))
        .sort((a, b) => (a.queuePosition ?? 999) - (b.queuePosition ?? 999) || b.createdAt.localeCompare(a.createdAt));
    }),
  createWalletAdjustment: (id: string, input: { direction: "credit" | "debit"; amount: number; description: string }) =>
    write(() => {
      const c = authorize("wallets", "manage");
      requireRole(c, "admin");
      if (!input.description.trim()) throw new ApiError(400, "REASON_REQUIRED", "Add a description; it's kept in the audit log.");
      const w = findWallet(c, id);
      const reference = `ADJ-${String(++c.s.seq).padStart(5, "0")}`;
      if (input.direction === "debit") {
        debitWallet(c.s, w, input.amount, { reference, description: input.description.trim() });
        audit(c, "wallet.adjusted", "wallet", w.id, `Debit ${formatMoney(input.amount)}: ${input.description}`, w.resellerId);
        return { outstandingPaid: 0, plansFunded: 0 };
      }
      const effect = creditWallet(c.s, w, input.amount, { type: w.kind === "house" ? "deposit" : "adjustment", reference, description: input.description.trim() });
      audit(c, "wallet.adjusted", "wallet", w.id, `Credit ${formatMoney(input.amount)}: ${input.description}`, w.resellerId);
      return effect;
    }),

  // ---------------------------------------------------------- transactions
  listTransactions: (f: TransactionFilters = {}) =>
    read((): Page<LedgerEntry> => {
      const c = authorize("transactions");
      const wallets = c.s.wallets.filter((w) => (c.tenant ? !f.resellerId || w.resellerId === f.resellerId : w.resellerId === c.resellerId));
      const ids = new Set(wallets.map((w) => w.id));
      const rows = c.s.ledger
        .filter((l) => ids.has(l.walletId) && (!f.walletId || l.walletId === f.walletId) && (!f.type || l.type === f.type))
        .filter((l) => (!f.from || l.createdAt.slice(0, 10) >= f.from) && (!f.to || l.createdAt.slice(0, 10) <= f.to))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
        .map((l): LedgerEntry => {
          const w = c.s.wallets.find((x) => x.id === l.walletId)!;
          return {
            id: l.id,
            walletId: l.walletId,
            walletName: walletName(c.s, w),
            resellerId: w.resellerId,
            type: l.type,
            amount: money(l.amount),
            balanceAfter: money(l.balanceAfter),
            reference: l.reference,
            description: l.description,
            estimated: l.estimated,
            createdAt: l.createdAt,
          };
        });
      return paginate(rows, f.page, f.pageSize ?? 25);
    }),

  // -------------------------------------------------------- top-up requests
  listTopupRequests: (filters: { status?: TopupRequest["status"] | null } = {}) =>
    read((): TopupRequest[] => {
      const c = authorize(["topup_requests", "wallets"]);
      return c.s.topups
        .filter((t) => (c.tenant || t.resellerId === c.resellerId) && (!filters.status || t.status === filters.status))
        .sort((a, b) => (a.status === "pending") === (b.status === "pending") ? b.createdAt.localeCompare(a.createdAt) : a.status === "pending" ? -1 : 1)
        .map((t) => topupView(c.s, t));
    }),
  createTopupRequest: (input: { amount: number; paymentReference: string; note: string }) =>
    write((): TopupRequest => {
      const c = authorize("topup_requests", "manage");
      requireRole(c, "reseller", "assistant");
      if (!(input.amount > 0)) throw new ApiError(400, "INVALID_AMOUNT", "Enter an amount above zero.");
      const reseller = c.s.resellers.find((r) => r.id === c.resellerId)!;
      const t = {
        id: `t${++c.s.seq}`,
        resellerId: c.resellerId!,
        walletId: walletOfReseller(c.s, c.resellerId).id,
        amount: Math.round(input.amount * 100) / 100,
        paymentReference: input.paymentReference.trim(),
        note: input.note.trim(),
        status: "pending" as const,
        requestedBy: c.u.id,
        createdAt: nowIso(),
        decidedAt: null,
        decidedBy: null,
        decisionNote: null,
        receiptNumber: null,
        outstandingPaid: null,
        plansFunded: null,
      };
      c.s.topups.unshift(t);
      notify(c.s, tenantAudience(c.s), `Top-up request from ${reseller.companyName}`, `${formatMoney(t.amount)} is waiting for approval.`, "/esim/topup-requests");
      return topupView(c.s, t);
    }),
  approveTopupRequest: (id: string) =>
    write((): TopupRequest => {
      const c = authorize("topup_requests", "manage");
      requireRole(c, "admin", "staff");
      const t = c.s.topups.find((x) => x.id === id);
      if (!t) throw new ApiError(404, "NOT_FOUND");
      if (t.status !== "pending") throw new ApiError(409, "NOT_PENDING");
      const w = c.s.wallets.find((x) => x.id === t.walletId)!;
      const receipt = `RC-${new Date().getUTCFullYear()}-${String(++receiptSeq).padStart(4, "0")}`;
      const effect = creditWallet(c.s, w, t.amount, { type: "topup", reference: receipt, description: "Wallet top-up (bank transfer)" });
      Object.assign(t, { status: "approved", decidedAt: nowIso(), decidedBy: c.u.id, receiptNumber: receipt, outstandingPaid: effect.outstandingPaid, plansFunded: effect.plansFunded });
      audit(c, "topup.approved", "topup_request", t.id, `Top-up of ${formatMoney(t.amount)} approved`, t.resellerId);
      const extra = [effect.outstandingPaid ? `${formatMoney(effect.outstandingPaid)} paid the outstanding amount.` : "", effect.plansFunded ? `${effect.plansFunded} waiting plan${effect.plansFunded > 1 ? "s" : ""} funded.` : ""].filter(Boolean).join(" ");
      notify(c.s, resellerAudience(c.s, t.resellerId), "Top-up approved", `${formatMoney(t.amount)} was added to your wallet. ${extra}`.trim(), "/esim/wallet");
      return topupView(c.s, t);
    }),
  rejectTopupRequest: (id: string, input: { decisionNote: string }) =>
    write(() => {
      const c = authorize("topup_requests", "manage");
      requireRole(c, "admin", "staff");
      const t = c.s.topups.find((x) => x.id === id);
      if (!t) throw new ApiError(404, "NOT_FOUND");
      if (t.status !== "pending") throw new ApiError(409, "NOT_PENDING");
      Object.assign(t, { status: "rejected", decidedAt: nowIso(), decidedBy: c.u.id, decisionNote: input.decisionNote.trim() });
      audit(c, "topup.rejected", "topup_request", t.id, `Top-up of ${formatMoney(t.amount)} rejected: ${input.decisionNote}`, t.resellerId);
      notify(c.s, resellerAudience(c.s, t.resellerId), "Top-up request rejected", input.decisionNote, "/esim/wallet");
    }),
  cancelTopupRequest: (id: string) =>
    write(() => {
      const c = authorize("topup_requests", "manage");
      requireRole(c, "reseller", "assistant");
      const t = c.s.topups.find((x) => x.id === id && x.resellerId === c.resellerId);
      if (!t) throw new ApiError(404, "NOT_FOUND");
      if (t.status !== "pending") throw new ApiError(409, "NOT_PENDING");
      Object.assign(t, { status: "cancelled", decidedAt: nowIso(), decidedBy: c.u.id });
    }),
};

export type WalletsApi = typeof demoWallets;
