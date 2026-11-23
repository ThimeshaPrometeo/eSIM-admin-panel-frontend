/**
 * Read models built from the demo tables, in the API's shapes (money as
 * decimal strings). Also the rules the backend applies: plan state mapping
 * (CONVENTIONS §7), wallet figures (available = balance − reserved).
 */
import { money } from "@/lib/platform/money";
import type { PlanState } from "@/lib/platform/status";
import type { Esim, EsimPlan, Me, Reseller, Wallet, WalletSummary } from "@/lib/platform/types";
import { effectivePermissions } from "@/lib/platform/permissions";
import type { DEsim, DHold, DPackage, DState, DUser, DWallet } from "./model";

export function reserved(s: DState, walletId: string) {
  return s.holds.filter((h) => h.walletId === walletId && h.status === "active").reduce((sum, h) => sum + Math.max(0, h.amount - h.used), 0);
}

export function waiting(s: DState, walletId: string) {
  const w = s.holds.filter((h) => h.walletId === walletId && h.status === "waiting");
  return { count: w.length, amount: w.reduce((a, h) => a + h.amount, 0) };
}

export function available(s: DState, w: DWallet) {
  return Math.max(0, w.balance - reserved(s, w.id));
}

export function walletName(s: DState, w: DWallet) {
  return w.kind === "house" ? "House wallet" : (s.resellers.find((r) => r.id === w.resellerId)?.companyName ?? "Wallet");
}

export function walletView(s: DState, w: DWallet): Wallet {
  const r = reserved(s, w.id);
  const wait = waiting(s, w.id);
  const avail = Math.max(0, w.balance - r);
  return {
    id: w.id,
    kind: w.kind,
    resellerId: w.resellerId,
    name: walletName(s, w),
    status: w.resellerId ? (s.resellers.find((x) => x.id === w.resellerId)?.status ?? "active") : "active",
    balance: money(w.balance),
    reserved: money(r),
    available: money(avail),
    outstanding: money(w.outstanding),
    waitingPlans: wait.count,
    waitingAmount: money(wait.amount),
    lowBalance: avail < w.lowThreshold,
  };
}

export function walletSummary(s: DState, w: DWallet): WalletSummary {
  const v = walletView(s, w);
  return { walletId: v.id, balance: v.balance, reserved: v.reserved, available: v.available, outstanding: v.outstanding, waitingPlans: v.waitingPlans, waitingAmount: v.waitingAmount };
}

export function walletOfReseller(s: DState, resellerId: string | null) {
  return s.wallets.find((w) => (resellerId ? w.resellerId === resellerId : w.kind === "house"))!;
}

/** The approved plan-state mapping (CONVENTIONS §7; backlog BB-2). */
export function planState(s: DState, p: DPackage, hold?: DHold): PlanState {
  const h = hold ?? s.holds.find((x) => x.id === p.holdId);
  const order = s.orders.find((o) => o.id === p.orderId);
  if (p.state === "deleted" || (h?.status === "settled" && p.state !== "expired" && p.state !== "depleted")) return "ended";
  if (p.state === "expired" || p.state === "depleted") return "expired";
  if (p.adminBlocked) return "blocked_by_admin";
  if (order?.status === "awaiting_funds") return "awaiting_funds";
  if (h?.status === "waiting") return "blocked_no_funds";
  if (h?.status === "exhausted") return "blocked_hold_used_up";
  if (p.state === "pending_activation") return "pending_first_use";
  return "active";
}

export function usedBytes(s: DState, p: DPackage) {
  const u = s.usage[p.id];
  return u ? Math.round(u.mb.reduce((a, b) => a + b, 0) * 1048576) : 0;
}

export function esimPlanView(s: DState, p: DPackage): EsimPlan {
  const h = s.holds.find((x) => x.id === p.holdId)!;
  return {
    id: p.id,
    orderId: p.orderId,
    planId: p.planId,
    name: p.name,
    state: planState(s, p, h),
    activation: p.activation,
    activationDate: p.activationDate,
    startedAt: p.startedAt,
    expiresAt: p.expiresAt,
    usedBytes: usedBytes(s, p),
    limitBytes: p.limitBytes,
    hold: { id: h.id, amount: money(h.amount), used: money(h.used), status: h.status },
    charges: { estimated: money(p.chargedEstimated), final: money(p.chargedFinal) },
    createdAt: p.createdAt,
  };
}

const LIVE: PlanState[] = ["active", "pending_first_use", "awaiting_funds", "blocked_no_funds", "blocked_hold_used_up", "blocked_by_admin"];

export function esimView(s: DState, e: DEsim): Esim {
  const plans = s.packages
    .filter((p) => p.esimId === e.id)
    .map((p) => esimPlanView(s, p))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const current = plans.filter((p) => LIVE.includes(p.state));
  const basis = current.length ? current : plans.slice(0, 1);
  return {
    id: e.id,
    iccid: e.iccid,
    status: e.status,
    suspendedBy: e.suspendedBy,
    installStatus: e.installStatus,
    installStatusRaw: e.installStatusRaw,
    resellerId: e.resellerId,
    resellerName: e.resellerId ? (s.resellers.find((r) => r.id === e.resellerId)?.companyName ?? null) : null,
    customerId: e.customerId,
    customerName: e.customerId ? (s.customers.find((c) => c.id === e.customerId)?.name ?? null) : null,
    plans,
    usedBytes: basis.reduce((a, p) => a + p.usedBytes, 0),
    limitBytes: basis.reduce((a, p) => a + p.limitBytes, 0),
    expiresAt: basis.map((p) => p.expiresAt).filter((x): x is string => !!x).sort().pop() ?? null,
    lastActivityAt: e.lastActivityAt,
    createdAt: e.createdAt,
  };
}

export function isLivePlan(state: PlanState) {
  return LIVE.includes(state);
}

export function resellerView(s: DState, r: DState["resellers"][number], showMarkup: boolean): Reseller {
  const w = walletOfReseller(s, r.id);
  return {
    id: r.id,
    companyName: r.companyName,
    contactName: r.contactName,
    email: r.email,
    phone: r.phone,
    status: r.status,
    markupPercent: showMarkup ? r.markupPercent : null,
    discountPercent: s.discounts.find((d) => d.resellerId === r.id && d.planId === null && d.status === "active")?.percent ?? null,
    wallet: walletSummary(s, w),
    esimCount: s.esims.filter((e) => e.resellerId === r.id).length,
    customerCount: s.customers.filter((c) => c.resellerId === r.id).length,
    assistantCount: s.users.filter((u) => u.role === "assistant" && u.resellerId === r.id).length,
    createdAt: r.createdAt,
  };
}

export function meFor(s: DState, u: DUser): Me {
  let permissions;
  if (u.role === "staff") permissions = effectivePermissions({ role: "staff", grants: s.staffRoles.find((r) => r.id === u.staffRoleId)?.grants ?? {} });
  else if (u.role === "assistant") permissions = effectivePermissions({ role: "assistant", grants: u.grants, reseller: effectivePermissions({ role: "reseller" }) });
  else permissions = effectivePermissions({ role: u.role });
  return {
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    resellerId: u.resellerId,
    resellerName: u.resellerId ? (s.resellers.find((r) => r.id === u.resellerId)?.companyName ?? null) : null,
    staffRoleName: u.staffRoleId ? (s.staffRoles.find((r) => r.id === u.staffRoleId)?.name ?? null) : null,
    permissions,
    mustChangePassword: u.mustChangePassword,
    mfaEnrolled: u.mfaEnrolled,
    hasPasskey: u.passkeys.length > 0,
    timeZone: "Asia/Colombo",
  };
}
