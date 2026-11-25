/**
 * Demo eSIMs and orders (spec 8.2–8.6), with the backend's rules:
 * - resellers and assistants see and act on their own eSIMs only (404 otherwise);
 * - they lift only their own suspensions (D57); package actions are admin/staff;
 *   end of life and deleting plans are admin only and final (D58);
 * - selling places a hold; without enough available balance a new eSIM can only
 *   start "On first use" and is blocked until funded, and an added plan waits as
 *   "Awaiting funds" (D46); an outstanding amount refuses new orders (D47);
 *   the same idempotency key returns the original result (D13).
 */
import { ApiError } from "./errors";
import { NETWORK_BY_ID, zoneNetworks } from "@/lib/demo/catalogue";
import { ledgerRow, lowWalletCheck } from "@/lib/demo/billing";
import { forEachPackageDay } from "@/lib/demo/rating";
import { available, esimView, walletOfReseller } from "@/lib/demo/derive";
import type { DEsim, DOrder, DPackage, DState } from "@/lib/demo/model";
import { holdFor, round2, type Buyer } from "@/lib/demo/pricing";
import { createRng, luhn } from "@/lib/demo/rng";
import { read, write } from "@/lib/demo/run";
import { SMDP_ADDRESS } from "@/lib/demo/seed";
import { assertScope, audit, authorize, notify, nowIso, paginate, requireRole, resellerAudience, tenantAudience, type Caller } from "@/lib/demo/session";
import { isPriced } from "@/lib/platform/coverage";
import { addDays, dateInZone } from "@/lib/platform/dates";
import { formatMoney, money } from "@/lib/platform/money";
import { rules } from "@/lib/platform/permissions";
import type { EsimStatus, InstallStatus, PlanState } from "@/lib/platform/status";
import type { Esim, EsimActivity, EsimCredentials, EsimDetail, Order, Page, SellInput, SellResult, UsageByNetwork, UsagePoint } from "@/lib/platform/types";
import { BYTES } from "@/lib/platform/units";

export type EsimFilters = {
  q?: string;
  status?: EsimStatus | "SUSPENDED_ANY" | null;
  installStatus?: InstallStatus | null;
  /** "blocked" = any blocked state; "needs_funds" = awaiting funds or blocked (dashboard link). */
  planState?: PlanState | "blocked" | "needs_funds" | null;
  planId?: string | null;
  country?: string | null;
  resellerId?: string | null;
  customerId?: string | null;
  page?: number;
  pageSize?: number;
};

/** Demo-only switch on the confirm step: what the supplier answers. */
export type SimulatedOutcome = "normal" | "needs_check" | "failed";

export type OrderFilters = { status?: Order["status"] | null; type?: Order["type"] | null; resellerId?: string | null };

function findEsim(c: Caller, id: string) {
  const e = c.s.esims.find((x) => x.id === id);
  if (!e) throw new ApiError(404, "NOT_FOUND");
  assertScope(c, e.resellerId);
  return e;
}

function findPackage(c: Caller, esimId: string, packageId: string) {
  const e = findEsim(c, esimId);
  const p = c.s.packages.find((x) => x.id === packageId && x.esimId === e.id);
  if (!p) throw new ApiError(404, "NOT_FOUND");
  return { e, p };
}

function lpa(e: DEsim) {
  return `LPA:1$${e.smdpAddress}$${e.activationCode}`;
}

function newIccid(s: DState) {
  const body = `893720401${String(100000000 + ((s.seq * 7919) % 899999999)).slice(-9)}`;
  return body + luhn(body);
}

function newCode(s: DState) {
  // a different code per eSIM, from the store's sequence (deterministic, no precision loss)
  const rng = createRng(s.seq * 7919 + 17);
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = () => Array.from({ length: 4 }, () => A[rng.int(0, A.length - 1)]).join("");
  return `${part()}-${part()}-${part()}-${part()}`;
}

function orderView(s: DState, o: DOrder): Order {
  const e = o.esimId ? s.esims.find((x) => x.id === o.esimId) : null;
  return {
    id: o.id,
    type: o.type,
    esimId: o.esimId,
    iccid: e?.iccid ?? null,
    planName: s.plans.find((p) => p.id === o.planId)?.name ?? "",
    resellerId: o.resellerId,
    resellerName: o.resellerId ? (s.resellers.find((r) => r.id === o.resellerId)?.companyName ?? null) : null,
    userName: s.users.find((u) => u.id === o.userId)?.fullName ?? "",
    status: o.status,
    funding: o.funding,
    holdAmount: money(o.holdAmount),
    failureReason: o.failureReason,
    createdAt: o.createdAt,
  };
}

/** The demo daily sale limit (Q-DAILYLIMIT). */
function countSale(s: DState) {
  const today = dateInZone(new Date());
  if (s.salesToday.date !== today) s.salesToday = { date: today, count: 0, capUsed: s.salesToday.capUsed };
  if (s.salesToday.count >= s.settings.dailySaleLimit) throw new ApiError(429, "DAILY_LIMIT_REACHED");
  if (s.salesToday.capUsed >= s.settings.saleCap) throw new ApiError(503, "SALE_CAP_REACHED");
}

const idempotent = new Map<string, SellResult>();

/** The shared sale logic for a new eSIM and for adding a plan (D46, D47, D13). */
function placeOrder(c: Caller, input: SellInput, opts: { esimId: string | null; key: string; simulate: SimulatedOutcome }): SellResult {
  const replay = idempotent.get(opts.key);
  if (replay) return replay;
  const s = c.s;
  const plan = s.plans.find((p) => p.id === input.planId && p.status === "active");
  if (!plan) throw new ApiError(409, "PLAN_NOT_ACTIVE", "This plan can't be sold right now.");
  if (!zoneNetworks(plan.zoneId).every(isPriced)) throw new ApiError(409, "ZONE_HAS_UNPRICED_NETWORKS");
  const resellerId = c.resellerId;
  if (resellerId && s.resellers.find((r) => r.id === resellerId)?.status !== "active") throw new ApiError(403, "RESELLER_SUSPENDED");
  const wallet = walletOfReseller(s, resellerId);
  if (wallet.outstanding > 0) throw new ApiError(409, "OUTSTANDING_BALANCE", undefined, { outstanding: money(wallet.outstanding) });
  const buyer: Buyer = resellerId ? { kind: "reseller", resellerId } : { kind: "house" };
  const hold = holdFor(s, plan, buyer);
  const funded = available(s, wallet) + 1e-9 >= hold;
  const isNew = opts.esimId === null;
  if (isNew) countSale(s);
  if (isNew && !funded && input.activation.mode !== "first_use") throw new ApiError(409, "ACTIVATION_REQUIRES_FUNDS");

  const orderId = `o${++s.seq}`;
  const order: DOrder = {
    id: orderId,
    type: isNew ? "new_esim" : "add_plan",
    esimId: opts.esimId,
    packageId: null,
    planId: plan.id,
    resellerId,
    userId: c.u.id,
    status: "pending",
    funding: funded ? "active" : "waiting",
    holdAmount: hold,
    failureReason: null,
    idempotencyKey: opts.key,
    retailAmount: input.retailAmount ? Number(input.retailAmount) : null,
    createdAt: nowIso(),
  };
  s.orders.unshift(order);
  const rp = input.resellerPlanId ? s.resellerPlans.find((x) => x.id === input.resellerPlanId && x.resellerId === resellerId) : null;

  // the supplier answers (demo switch for the other outcomes)
  if (funded && opts.simulate === "failed") {
    order.status = "failed";
    order.funding = null;
    order.failureReason = "The supplier rejected the request. No money was taken; the hold was released.";
    const r: SellResult = { outcome: "failed", orderId, reason: order.failureReason };
    idempotent.set(opts.key, r);
    return r;
  }
  if (funded && opts.simulate === "needs_check") {
    order.status = "needs_check";
    ledgerRow(s, wallet, { type: "hold", amount: -hold, reference: orderId.toUpperCase(), description: `Hold for ${plan.name} (being verified)` });
    notify(s, tenantAudience(s), "An order is being verified", `The supplier didn't confirm a ${plan.name} sale.`, `/esim/orders/${orderId}`);
    const r: SellResult = { outcome: "needs_check", orderId };
    idempotent.set(opts.key, r);
    return r;
  }

  let esim: DEsim;
  if (isNew) {
    esim = {
      id: `e${++s.seq}`,
      iccid: newIccid(s),
      status: "ACTIVE",
      suspendedBy: null,
      installStatus: "not_installed",
      installStatusRaw: null,
      resellerId,
      customerId: input.customerId ?? null,
      activationCode: newCode(s),
      smdpAddress: SMDP_ADDRESS,
      createdAt: nowIso(),
      lastActivityAt: null,
    };
    s.esims.unshift(esim);
    s.settings.freeStock = Math.max(0, s.settings.freeStock - 1);
    s.salesToday.count += 1;
    s.salesToday.capUsed += 1;
  } else {
    esim = s.esims.find((e) => e.id === opts.esimId)!;
  }
  order.esimId = esim.id;

  const network = [...zoneNetworks(plan.zoneId)].filter(isPriced).sort((a, b) => a.costPerMb! - b.costPerMb!)[0]!;
  const startNow = funded && input.activation.mode === "now";
  const pkg: DPackage = {
    id: `pk${++s.seq}`,
    esimId: esim.id,
    orderId,
    planId: plan.id,
    resellerPlanId: rp?.id ?? null,
    name: rp?.name ?? plan.name,
    activation: input.activation.mode,
    activationDate: input.activation.mode === "date" ? (input.activation.start ?? null) : null,
    startedAt: startNow ? nowIso() : null,
    expiresAt: startNow ? new Date(`${addDays(dateInZone(new Date()), plan.validityDays)}T23:59:00+05:30`).toISOString() : null,
    limitBytes: plan.dataBytes,
    state: startNow ? "active" : "pending_activation",
    adminBlocked: false,
    networkId: network.id,
    altNetworkId: null,
    holdId: `h${++s.seq}`,
    chargedFinal: 0,
    chargedEstimated: 0,
    createdAt: nowIso(),
  };
  s.packages.push(pkg);
  s.holds.push({ id: pkg.holdId, walletId: wallet.id, packageId: pkg.id, esimId: esim.id, orderId, amount: hold, used: 0, status: funded ? "active" : "waiting", createdAt: nowIso(), fundedAt: funded ? nowIso() : null });
  order.packageId = pkg.id;
  if (funded) ledgerRow(s, wallet, { type: "hold", amount: -hold, reference: orderId.toUpperCase(), description: `Hold for ${pkg.name}` });

  if (!funded && !isNew) {
    // add plan without funds: waits, nothing is created at the supplier yet
    order.status = "awaiting_funds";
    const r: SellResult = { outcome: "awaiting_funds", orderId, esimId: esim.id, planName: pkg.name };
    idempotent.set(opts.key, r);
    if (resellerId) notify(s, resellerAudience(s, resellerId), "A plan is waiting for funds", `${pkg.name} starts when your wallet covers ${formatMoney(hold)}.`, "/esim/wallet");
    return r;
  }
  order.status = "completed";
  if (!funded && resellerId) notify(s, resellerAudience(s, resellerId), "eSIM blocked until funded", `${pkg.name} unblocks when your wallet covers ${formatMoney(hold)}.`, "/esim/wallet");
  lowWalletCheck(s, wallet);
  audit(c, isNew ? "order.esim_sold" : "order.plan_added", "order", orderId, `${pkg.name} ${isNew ? "sold" : "added"}`, resellerId);
  const r: SellResult = {
    outcome: "completed",
    orderId,
    esimId: esim.id,
    iccid: esim.iccid,
    activationCode: esim.activationCode,
    smdpAddress: esim.smdpAddress,
    lpa: lpa(esim),
    funding: funded ? "active" : "waiting",
    planName: pkg.name,
    limitBytes: pkg.limitBytes,
  };
  idempotent.set(opts.key, r);
  return r;
}

function setPackageEnded(s: DState, p: DPackage) {
  p.state = "deleted";
  const h = s.holds.find((x) => x.id === p.holdId);
  if (h && (h.status === "active" || h.status === "waiting" || h.status === "exhausted")) {
    const release = h.status === "active" ? round2(h.amount - h.used) : 0;
    h.status = h.status === "waiting" ? "cancelled" : "settled";
    if (release > 0) {
      const w = s.wallets.find((x) => x.id === h.walletId)!;
      ledgerRow(s, w, { type: "hold_release", amount: release, reference: h.orderId.toUpperCase(), description: `Hold released: ${p.name}` });
    }
  }
}

export const demoEsims = {
  listEsims: (f: EsimFilters = {}) =>
    read((): Page<Esim> => {
      const c = authorize("esims");
      const q = f.q?.trim().toLowerCase();
      const rows = c.s.esims
        .filter((e) => (c.tenant ? f.resellerId === undefined || f.resellerId === null || e.resellerId === (f.resellerId === "direct" ? null : f.resellerId) : e.resellerId === c.resellerId))
        .filter((e) => !f.customerId || e.customerId === f.customerId)
        .map((e) => esimView(c.s, e))
        .filter((e) => !q || e.iccid.includes(q) || (e.customerName ?? "").toLowerCase().includes(q))
        .filter((e) => !f.status || (f.status === "SUSPENDED_ANY" ? e.status === "SUSPENDED" : e.status === f.status))
        .filter((e) => !f.installStatus || e.installStatus === f.installStatus)
        .filter(
          (e) =>
            !f.planState ||
            e.plans.some((p) =>
              f.planState === "blocked" ? p.state.startsWith("blocked") : f.planState === "needs_funds" ? p.state === "awaiting_funds" || p.state.startsWith("blocked") : p.state === f.planState,
            ),
        )
        .filter((e) => !f.planId || e.plans.some((p) => p.planId === f.planId))
        .filter((e) => !f.country || e.plans.some((p) => NETWORK_BY_ID.get(c.s.packages.find((x) => x.id === p.id)!.networkId)?.iso2 === f.country))
        .sort((a, b) => (b.lastActivityAt ?? b.createdAt).localeCompare(a.lastActivityAt ?? a.createdAt));
      return paginate(rows, f.page, f.pageSize ?? 1000);
    }),
  getEsim: (id: string) =>
    read((): EsimDetail => {
      const c = authorize("esims");
      const e = findEsim(c, id);
      const customer = e.customerId ? c.s.customers.find((x) => x.id === e.customerId) : null;
      return { ...esimView(c.s, e), activationCode: e.activationCode, smdpAddress: e.smdpAddress, lpa: lpa(e), customerEmail: customer?.email ?? null };
    }),
  /** Read live by the backend, never stored; every reveal is audit-logged (D28, D56). */
  getEsimCredentials: (id: string) =>
    write((): EsimCredentials => {
      const c = authorize("esims");
      const e = findEsim(c, id);
      audit(c, "esim.credentials_viewed", "esim", e.id, "PIN and PUK shown", e.resellerId);
      const d = e.iccid;
      return { pin1: d.slice(-4), puk1: d.slice(-12, -4), pin2: d.slice(-8, -4), puk2: `${d.slice(5, 9)}${d.slice(-4)}` };
    }),
  getEsimActivity: (id: string) =>
    read((): EsimActivity[] => {
      const c = authorize("esims");
      const e = findEsim(c, id);
      const name = (uid: string | null) => (uid ? (c.s.users.find((u) => u.id === uid)?.fullName ?? null) : null);
      const items: EsimActivity[] = [];
      for (const o of c.s.orders.filter((x) => x.esimId === e.id)) {
        const p = c.s.plans.find((x) => x.id === o.planId)?.name ?? "";
        const title =
          o.status === "awaiting_funds" ? `${p} added, waiting for funds` : o.status === "cancelled" ? `${p} cancelled` : o.status === "failed" ? `${p} failed` : o.type === "new_esim" ? `eSIM sold with ${p}` : `${p} added`;
        items.push({ id: o.id, at: o.createdAt, kind: "order", title, detail: `Hold ${formatMoney(o.holdAmount)}`, actor: name(o.userId) });
      }
      for (const p of c.s.packages.filter((x) => x.esimId === e.id)) {
        if (p.startedAt) items.push({ id: `${p.id}-s`, at: p.startedAt, kind: "plan", title: `${p.name} started`, detail: p.activation === "first_use" ? "On first use" : p.activation === "now" ? "Activated at sale" : "On the set date", actor: null });
        if ((p.state === "expired" || p.state === "depleted") && p.expiresAt) items.push({ id: `${p.id}-e`, at: p.expiresAt, kind: "plan", title: `${p.name} ${p.state === "depleted" ? "used up" : "expired"}`, detail: null, actor: null });
      }
      for (const a of c.s.audit.filter((x) => x.entityType === "esim" && x.entityId === e.id))
        items.push({ id: a.id, at: a.createdAt, kind: a.action === "esim.credentials_viewed" ? "credentials_viewed" : "status", title: a.summary, detail: null, actor: name(a.actorId) });
      if (e.installStatus !== "not_installed" && e.lastActivityAt) items.push({ id: `${e.id}-i`, at: e.lastActivityAt, kind: "install", title: `Install status: ${e.installStatusRaw ?? e.installStatus.replace("_", " ")}`, detail: "Reported by the supplier", actor: null });
      return items.sort((a, b) => b.at.localeCompare(a.at));
    }),
  /** Usage for one eSIM: per day, and by country and network with the viewer's charges. */
  getEsimUsage: (id: string, period: { from: string; to: string }) =>
    read((): { daily: UsagePoint[]; byNetwork: UsageByNetwork[] } => {
      const c = authorize(["usage", "esims"]);
      const e = findEsim(c, id);
      const days = new Map<string, { bytes: number; estimated: boolean }>();
      const nets = new Map<string, UsageByNetwork & { amountN: number }>();
      // charged at the owner's prices (the house wallet pays Yesim cost), from the rated lines
      forEachPackageDay(
        c.s,
        (_p, day, lines) => {
          const d = days.get(day) ?? { bytes: 0, estimated: false };
          for (const l of lines) {
            const n = NETWORK_BY_ID.get(l.networkId)!;
            d.bytes += l.mb * BYTES.MB;
            d.estimated ||= l.estimated;
            const row = nets.get(n.id) ?? { iso2: n.iso2, country: n.country, operator: n.operator, bytes: 0, amount: "0", amountN: 0, estimated: false };
            row.bytes += l.mb * BYTES.MB;
            row.amountN += l.amount;
            row.estimated ||= l.estimated;
            nets.set(n.id, row);
          }
          days.set(day, d);
        },
        { packages: (p) => p.esimId === e.id, from: period.from, to: period.to },
      );
      const daily: UsagePoint[] = [];
      for (let d = period.from; d <= period.to; d = addDays(d, 1)) daily.push({ date: d, bytes: days.get(d)?.bytes ?? 0, estimated: days.get(d)?.estimated ?? false });
      return { daily, byNetwork: [...nets.values()].map(({ amountN, ...r }) => ({ ...r, amount: money(amountN) })).sort((a, b) => b.bytes - a.bytes) };
    }),

  // ------------------------------------------------------------- actions
  suspendEsim: (id: string, input: { reason?: string } = {}) =>
    write(() => {
      const c = authorize("esims", "manage");
      const e = findEsim(c, id);
      if (e.status === "END_OF_LIFE") throw new ApiError(409, "END_OF_LIFE_FINAL");
      e.status = "SUSPENDED";
      e.suspendedBy = c.tenant ? "admin" : "reseller";
      audit(c, "esim.suspended", "esim", e.id, `Suspended${input.reason ? `: ${input.reason}` : ""}`, e.resellerId);
    }),
  reactivateEsim: (id: string, input: { reason?: string } = {}) =>
    write(() => {
      const c = authorize("esims", "manage");
      const e = findEsim(c, id);
      if (e.status === "END_OF_LIFE") throw new ApiError(409, "END_OF_LIFE_FINAL");
      if (!rules.canReactivate(c.me, e.suspendedBy)) throw new ApiError(403, "REACTIVATE_NOT_ALLOWED");
      e.status = "ACTIVE";
      e.suspendedBy = null;
      audit(c, "esim.reactivated", "esim", e.id, `Reactivated${input.reason ? `: ${input.reason}` : ""}`, e.resellerId);
    }),
  /** Admin only. End of life needs the ICCID typed as confirmation and is final (D58). */
  setEndOfLife: (id: string, input: { reason: string; confirmation: string }) =>
    write(() => {
      const c = authorize("esims", "manage");
      requireRole(c, "admin");
      const e = findEsim(c, id);
      if (e.status === "END_OF_LIFE") throw new ApiError(409, "END_OF_LIFE_FINAL");
      if (input.confirmation.trim() !== e.iccid) throw new ApiError(400, "CONFIRMATION_MISMATCH", "Type the eSIM's ICCID exactly to confirm.");
      e.status = "END_OF_LIFE";
      e.suspendedBy = null;
      for (const p of c.s.packages.filter((x) => x.esimId === e.id && (x.state === "active" || x.state === "pending_activation"))) setPackageEnded(c.s, p);
      audit(c, "esim.end_of_life", "esim", e.id, `Set to end of life: ${input.reason}`, e.resellerId);
    }),
  extendPackage: (esimId: string, packageId: string, input: { days: number; reason: string }) =>
    write(() => {
      const c = authorize("esims", "manage");
      requireRole(c, "admin", "staff");
      const { e, p } = findPackage(c, esimId, packageId);
      const base = p.expiresAt ? new Date(p.expiresAt) : new Date();
      p.expiresAt = new Date(base.getTime() + input.days * 86400000).toISOString();
      if (p.state === "expired") p.state = "active";
      audit(c, "esim.plan_extended", "esim", e.id, `${p.name} extended by ${input.days} days: ${input.reason}`, e.resellerId);
    }),
  /** Add data: the hold grows first (409 if the wallet can't cover it). */
  addPackageData: (esimId: string, packageId: string, input: { addBytes: number; reason: string }) =>
    write(() => {
      const c = authorize("esims", "manage");
      requireRole(c, "admin", "staff");
      const { e, p } = findPackage(c, esimId, packageId);
      const h = c.s.holds.find((x) => x.id === p.holdId)!;
      const w = c.s.wallets.find((x) => x.id === h.walletId)!;
      const plan = c.s.plans.find((x) => x.id === p.planId)!;
      const buyer: Buyer = e.resellerId ? { kind: "reseller", resellerId: e.resellerId } : { kind: "house" };
      const extraHold = plan.holdOverride !== null ? 0 : round2((input.addBytes / plan.dataBytes) * holdFor(c.s, plan, buyer));
      if (extraHold > available(c.s, w) + 1e-9) throw new ApiError(409, "INSUFFICIENT_FUNDS");
      p.limitBytes += input.addBytes;
      if (p.state === "depleted") p.state = "active";
      if (extraHold > 0) {
        h.amount = round2(h.amount + extraHold);
        ledgerRow(c.s, w, { type: "hold", amount: -extraHold, reference: h.orderId.toUpperCase(), description: `Hold increased: ${p.name}` });
      }
      if (h.status === "exhausted") h.status = "active";
      audit(c, "esim.plan_data_added", "esim", e.id, `${p.name}: data added (${Math.round(input.addBytes / BYTES.MB)} MB): ${input.reason}`, e.resellerId);
    }),
  setPackageBlocked: (esimId: string, packageId: string, input: { blocked: boolean; reason: string }) =>
    write(() => {
      const c = authorize("esims", "manage");
      requireRole(c, "admin", "staff");
      const { e, p } = findPackage(c, esimId, packageId);
      p.adminBlocked = input.blocked;
      audit(c, input.blocked ? "esim.plan_blocked" : "esim.plan_unblocked", "esim", e.id, `${p.name} ${input.blocked ? "blocked" : "unblocked"}: ${input.reason}`, e.resellerId);
    }),
  deletePackage: (esimId: string, packageId: string, input: { reason: string }) =>
    write(() => {
      const c = authorize("esims", "manage");
      requireRole(c, "admin");
      const { e, p } = findPackage(c, esimId, packageId);
      setPackageEnded(c.s, p);
      audit(c, "esim.plan_deleted", "esim", e.id, `${p.name} deleted: ${input.reason}`, e.resellerId);
    }),
  setEsimCustomer: (id: string, customerId: string | null) =>
    write(() => {
      const c = authorize("esims", "manage");
      const e = findEsim(c, id);
      if (customerId) {
        const cust = c.s.customers.find((x) => x.id === customerId);
        if (!cust || cust.resellerId !== e.resellerId) throw new ApiError(404, "NOT_FOUND");
      }
      e.customerId = customerId;
    }),
  emailEsimQr: (id: string, email: string) =>
    write(() => {
      const c = authorize("esims");
      const e = findEsim(c, id);
      audit(c, "esim.qr_emailed", "esim", e.id, `QR code emailed to ${email}`, e.resellerId);
      return email;
    }),

  // -------------------------------------------------------------- selling
  createEsimOrder: (input: SellInput, idempotencyKey: string, simulate: SimulatedOutcome = "normal") =>
    write((): SellResult => {
      const c = authorize("sell_esim", "manage");
      return placeOrder(c, input, { esimId: null, key: idempotencyKey, simulate });
    }),
  addPlanToEsim: (esimId: string, input: SellInput, idempotencyKey: string, simulate: SimulatedOutcome = "normal") =>
    write((): SellResult => {
      const c = authorize("sell_esim", "manage");
      const e = findEsim(c, esimId);
      if (e.status === "END_OF_LIFE") throw new ApiError(409, "END_OF_LIFE_FINAL");
      return placeOrder(c, input, { esimId: e.id, key: idempotencyKey, simulate });
    }),
  /** What selling would do now for this viewer: hold, available, and whether it's refused (for the confirm step). */
  getSellContext: (planId: string) =>
    read(() => {
      const c = authorize("sell_esim", "manage");
      const plan = c.s.plans.find((p) => p.id === planId);
      if (!plan) throw new ApiError(404, "NOT_FOUND");
      const w = walletOfReseller(c.s, c.resellerId);
      const buyer: Buyer = c.resellerId ? { kind: "reseller", resellerId: c.resellerId } : { kind: "house" };
      const hold = holdFor(c.s, plan, buyer);
      const avail = available(c.s, w);
      const today = dateInZone(new Date());
      const sold = c.s.salesToday.date === today ? c.s.salesToday.count : 0;
      return {
        hold: money(hold),
        available: money(avail),
        after: money(Math.max(0, avail - hold)),
        enough: avail + 1e-9 >= hold,
        outstanding: money(w.outstanding),
        dailyLimitReached: sold >= c.s.settings.dailySaleLimit,
        direct: !c.resellerId,
        walletName: c.resellerId ? "Your wallet" : "House wallet",
      };
    }),

  // --------------------------------------------------------------- orders
  listOrders: (f: OrderFilters = {}) =>
    read((): Order[] => {
      const c = authorize(["sell_esim", "transactions"]);
      return c.s.orders
        .filter((o) => (c.tenant ? !f.resellerId || o.resellerId === (f.resellerId === "direct" ? null : f.resellerId) : o.resellerId === c.resellerId))
        .filter((o) => (!f.status || o.status === f.status) && (!f.type || o.type === f.type))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((o) => orderView(c.s, o));
    }),
  getOrder: (id: string) =>
    read((): Order => {
      const c = authorize(["sell_esim", "transactions"]);
      const o = c.s.orders.find((x) => x.id === id);
      if (!o) throw new ApiError(404, "NOT_FOUND");
      assertScope(c, o.resellerId);
      return orderView(c.s, o);
    }),
  /** Admin/staff: asks the supplier about a "being verified" order (demo: no match found yet). */
  checkOrder: (id: string) =>
    read(() => {
      const c = authorize("esims", "manage");
      requireRole(c, "admin", "staff");
      const o = c.s.orders.find((x) => x.id === id);
      if (!o || o.status !== "needs_check") throw new ApiError(409, "NOT_PENDING", "Only orders being verified can be checked.");
      return { matched: false, candidates: [] as string[] };
    }),
  /** Admin: completes a "being verified" order with the ICCID the supplier confirms, or fails it (hold released). */
  resolveOrder: (id: string, input: { outcome: "completed"; iccid: string } | { outcome: "failed"; note: string }) =>
    write(() => {
      const c = authorize("sell_esim");
      requireRole(c, "admin");
      const o = c.s.orders.find((x) => x.id === id);
      if (!o || o.status !== "needs_check") throw new ApiError(409, "NOT_PENDING", "Only orders being verified can be resolved.");
      const w = walletOfReseller(c.s, o.resellerId);
      const plan = c.s.plans.find((p) => p.id === o.planId)!;
      if (input.outcome === "failed") {
        o.status = "failed";
        o.failureReason = input.note || "The supplier confirmed no eSIM was created. The hold was released.";
        ledgerRow(c.s, w, { type: "hold_release", amount: o.holdAmount, reference: o.id.toUpperCase(), description: `Hold released: ${plan.name}` });
        audit(c, "order.resolved_failed", "order", o.id, `Resolved as failed: ${o.failureReason}`, o.resellerId);
        return;
      }
      if (!/^\d{19,20}$/.test(input.iccid.trim())) throw new ApiError(400, "INVALID_ICCID", "An ICCID has 19 or 20 digits.");
      if (c.s.esims.some((e) => e.iccid === input.iccid.trim())) throw new ApiError(409, "ICCID_IN_USE", "That eSIM is already ours. Check the ICCID with the supplier.");
      const esim: DEsim = {
        id: `e${++c.s.seq}`,
        iccid: input.iccid.trim(),
        status: "ACTIVE",
        suspendedBy: null,
        installStatus: "not_installed",
        installStatusRaw: null,
        resellerId: o.resellerId,
        customerId: null,
        activationCode: newCode(c.s),
        smdpAddress: SMDP_ADDRESS,
        createdAt: nowIso(),
        lastActivityAt: null,
      };
      c.s.esims.unshift(esim);
      const net = zoneNetworks(plan.zoneId).filter(isPriced)[0]!;
      const pkg: DPackage = {
        id: `pk${++c.s.seq}`,
        esimId: esim.id,
        orderId: o.id,
        planId: plan.id,
        resellerPlanId: null,
        name: plan.name,
        activation: "first_use",
        activationDate: null,
        startedAt: null,
        expiresAt: null,
        limitBytes: plan.dataBytes,
        state: "pending_activation",
        adminBlocked: false,
        networkId: net.id,
        altNetworkId: null,
        holdId: `h${++c.s.seq}`,
        chargedFinal: 0,
        chargedEstimated: 0,
        createdAt: o.createdAt,
      };
      c.s.packages.push(pkg);
      c.s.holds.push({ id: pkg.holdId, walletId: w.id, packageId: pkg.id, esimId: esim.id, orderId: o.id, amount: o.holdAmount, used: 0, status: "active", createdAt: o.createdAt, fundedAt: o.createdAt });
      o.status = "completed";
      o.esimId = esim.id;
      o.packageId = pkg.id;
      audit(c, "order.resolved_completed", "order", o.id, `Resolved as completed with ICCID ${esim.iccid}`, o.resellerId);
      if (o.resellerId) notify(c.s, resellerAudience(c.s, o.resellerId), "Order confirmed", `${plan.name} is ready on eSIM …${esim.iccid.slice(-6)}.`, `/esim/esims/${esim.id}`);
    }),
  /** Owner cancels a plan still waiting for funds; its hold is cancelled. */
  cancelOrder: (id: string) =>
    write(() => {
      const c = authorize("sell_esim", "manage");
      const o = c.s.orders.find((x) => x.id === id);
      if (!o) throw new ApiError(404, "NOT_FOUND");
      assertScope(c, o.resellerId);
      const h = c.s.holds.find((x) => x.orderId === o.id);
      if (!h || h.status !== "waiting") throw new ApiError(409, "NOT_WAITING", "Only plans waiting for funds can be cancelled.");
      h.status = "cancelled";
      o.status = "cancelled";
      const p = c.s.packages.find((x) => x.id === h.packageId);
      if (p) p.state = "deleted";
      audit(c, "order.cancelled", "order", o.id, `${p?.name ?? "Plan"} cancelled while waiting for funds`, o.resellerId);
    }),
};

export type EsimsApi = typeof demoEsims;
