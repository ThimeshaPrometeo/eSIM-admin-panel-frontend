/**
 * Wallet money rules (spec 2.1, backend billing.md), as the backend applies
 * them:
 * - a credit (top-up, adjustment, deposit) first pays any outstanding amount,
 *   then runs the funding queue;
 * - funding queue: waiting holds oldest first; each one that fits the
 *   available balance is funded, the next one that doesn't fit is skipped
 *   ("skip ahead"); funded plans unblock or start;
 * - no wallet ever goes below its reserved amount (so never negative).
 */
import { ApiError } from "@/lib/api/errors";
import { addDays, dateInZone } from "@/lib/platform/dates";
import { formatMoney } from "@/lib/platform/money";
import { available, reserved, walletName } from "./derive";
import type { DState, DWallet } from "./model";
import { round2 } from "./pricing";
import { resellerAudience, notify, tenantAudience } from "./session";

const now = () => new Date().toISOString();

export function ledgerRow(s: DState, w: DWallet, row: { type: DState["ledger"][number]["type"]; amount: number; reference: string; description: string; estimated?: boolean | null }) {
  const moves = row.type !== "hold" && row.type !== "hold_release";
  if (moves) w.balance = round2(w.balance + row.amount);
  s.ledger.push({
    id: `l${++s.seq}`,
    walletId: w.id,
    type: row.type,
    amount: round2(row.amount),
    balanceAfter: w.balance,
    reference: row.reference,
    description: row.description,
    estimated: row.estimated ?? null,
    createdAt: now(),
  });
}

/** Funds waiting plans, oldest first, skipping ones that don't fit. Returns how many were funded. */
export function runFundingQueue(s: DState, w: DWallet): number {
  const queue = s.holds.filter((h) => h.walletId === w.id && h.status === "waiting").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let funded = 0;
  for (const h of queue) {
    if (h.amount > available(s, w) + 1e-9) continue; // skip ahead
    h.status = "active";
    h.fundedAt = now();
    const pkg = s.packages.find((p) => p.id === h.packageId);
    const order = s.orders.find((o) => o.id === h.orderId);
    if (order) {
      if (order.status === "awaiting_funds") order.status = "completed";
      order.funding = "active";
    }
    if (pkg && pkg.activation === "now" && pkg.state === "pending_activation") {
      const plan = s.plans.find((p) => p.id === pkg.planId);
      pkg.state = "active";
      pkg.startedAt = now();
      pkg.expiresAt = new Date(`${addDays(dateInZone(new Date()), plan?.validityDays ?? 30)}T23:59:00+05:30`).toISOString();
    }
    ledgerRow(s, w, { type: "hold", amount: -h.amount, reference: h.orderId.toUpperCase(), description: `Hold for ${pkg?.name ?? "plan"}` });
    funded += 1;
    if (w.resellerId) {
      const esim = s.esims.find((e) => e.id === h.esimId);
      notify(s, resellerAudience(s, w.resellerId), `${pkg?.name ?? "A plan"} is funded`, `eSIM …${esim?.iccid.slice(-6) ?? ""} is no longer waiting for funds.`, esim ? `/esim/esims/${esim.id}` : null);
    }
  }
  return funded;
}

/** A credit to a wallet: pays the outstanding amount first, then funds waiting plans. */
export function creditWallet(s: DState, w: DWallet, amount: number, row: { type: "topup" | "adjustment" | "deposit"; reference: string; description: string }) {
  if (amount <= 0) throw new ApiError(400, "INVALID_AMOUNT", "Enter an amount above zero.");
  ledgerRow(s, w, { type: row.type, amount, reference: row.reference, description: row.description });
  let outstandingPaid = 0;
  if (w.outstanding > 0) {
    outstandingPaid = round2(Math.min(w.outstanding, w.balance));
    w.outstanding = round2(w.outstanding - outstandingPaid);
    ledgerRow(s, w, { type: "outstanding_recovery", amount: -outstandingPaid, reference: row.reference, description: "Outstanding amount paid" });
  }
  const plansFunded = runFundingQueue(s, w);
  return { outstandingPaid, plansFunded };
}

/** A manual debit adjustment: never below the reserved amount. */
export function debitWallet(s: DState, w: DWallet, amount: number, row: { reference: string; description: string }) {
  if (amount <= 0) throw new ApiError(400, "INVALID_AMOUNT", "Enter an amount above zero.");
  if (amount > w.balance - reserved(s, w.id) + 1e-9) throw new ApiError(409, "INSUFFICIENT_AVAILABLE");
  ledgerRow(s, w, { type: "adjustment", amount: -amount, reference: row.reference, description: row.description });
}

export function lowWalletCheck(s: DState, w: DWallet) {
  if (available(s, w) < w.lowThreshold) {
    const audience = w.kind === "house" ? tenantAudience(s).filter((id) => s.users.find((u) => u.id === id)?.role === "admin") : tenantAudience(s);
    notify(s, audience, `Low wallet: ${walletName(s, w)}`, `Available balance is ${formatMoney(available(s, w))}.`, `/esim/wallets/${w.id}`);
  }
}
