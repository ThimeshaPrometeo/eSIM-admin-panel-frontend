/**
 * Permissions (spec 5, CONVENTIONS §5). Display only: the backend decides on
 * every request. In API mode the effective permissions come from
 * `GET /auth/me`; these functions compute them only in the demo store and
 * decide what the UI shows.
 *
 * Effective = tenant envelope ∩ role envelope ∩ grants (D23).
 * - admin and reseller: grants are implicit `manage`;
 * - staff: grants from their staff role;
 * - assistant: grant = min(toggle, effective permission of their reseller).
 */
import { atLeast, minLevel, type Grants, type Level } from "./permission-matrix";
import { MODULES, type Me, type Module, type Permissions, type Role } from "./types";

const V: Level = "view";
const M: Level = "manage";
const N: Level = "none";

/** Spec 5.3: the most each role can ever have. */
export const ROLE_ENVELOPES: Record<Role, Permissions> = {
  admin: env({
    dashboard: V, sell_esim: M, esims: M, usage: V, orders: M, inventory: M, alerts: M, plans: M, reseller_plans: V,
    coverage: V, price_lists: M, discounts: M, resellers: M, customers: M, assistants: V, team: N, wallets: M,
    transactions: V, topup_requests: M, invoices: M, profit_reports: M, users: M, staff_roles: M, settings: M,
    yesim_connection: M, audit_log: V,
  }),
  staff: env({
    dashboard: V, sell_esim: M, esims: M, usage: V, orders: M, inventory: M, alerts: M, plans: M, reseller_plans: V,
    coverage: V, price_lists: M, discounts: M, resellers: M, customers: M, assistants: V, team: N, wallets: M,
    transactions: V, topup_requests: M, invoices: M, profit_reports: V, users: M, staff_roles: V, settings: V,
    yesim_connection: V, audit_log: V,
  }),
  reseller: env({
    dashboard: V, sell_esim: M, esims: M, usage: V, orders: V, alerts: V, reseller_plans: M, coverage: V,
    price_lists: V, discounts: V, customers: M, team: M, wallets: V, transactions: V, topup_requests: M, invoices: V,
  }),
  assistant: env({
    dashboard: V, sell_esim: M, esims: M, usage: V, orders: V, alerts: V, reseller_plans: M, coverage: V,
    price_lists: V, discounts: V, customers: M, wallets: V, transactions: V, topup_requests: M, invoices: V,
  }),
};

/** Tenant 1 has every feature. */
export const TENANT_ENVELOPE: Permissions = env(Object.fromEntries(MODULES.map((m) => [m, M])) as Partial<Permissions>);

function env(partial: Partial<Permissions>): Permissions {
  return Object.fromEntries(MODULES.map((m) => [m, partial[m] ?? N])) as Permissions;
}

function intersect(...sets: Partial<Record<string, Level>>[]): Permissions {
  return Object.fromEntries(MODULES.map((m) => [m, sets.reduce<Level>((acc, s) => minLevel(acc, s[m] ?? N), M)])) as Permissions;
}

export type PermissionInput =
  | { role: "admin" | "reseller"; tenant?: Permissions }
  | { role: "staff"; grants: Grants; tenant?: Permissions }
  | { role: "assistant"; grants: Grants; reseller: Permissions; tenant?: Permissions };

export function effectivePermissions(input: PermissionInput): Permissions {
  const tenant = input.tenant ?? TENANT_ENVELOPE;
  const role = ROLE_ENVELOPES[input.role];
  switch (input.role) {
    case "admin":
    case "reseller":
      return intersect(tenant, role);
    case "staff":
      return intersect(tenant, role, input.grants);
    case "assistant": {
      const p = intersect(tenant, role, input.grants, input.reseller);
      // Orders has no toggle: it follows Sell eSIM or Transactions (backend; backlog BB-1).
      p.orders = atLeast(p.sell_esim, "view") || atLeast(p.transactions, "view") ? "view" : "none";
      return p;
    }
  }
}

export function can(perms: Permissions | null | undefined, module: Module, level: Level = "view"): boolean {
  return !!perms && atLeast(perms[module], level);
}

export function canAny(perms: Permissions | null | undefined, modules: readonly Module[], level: Level = "view") {
  return modules.some((m) => can(perms, m, level));
}

// ---- role rules on top of module levels (the backend's @Roles(...)), so pages never check roles inline

type Who = Pick<Me, "role" | "permissions"> | null | undefined;
const isTenant = (me: Who) => me?.role === "admin" || me?.role === "staff";
const isResellerSide = (me: Who) => me?.role === "reseller" || me?.role === "assistant";

export const rules = {
  isTenantUser: (me: Who) => isTenant(me),
  isResellerSide: (me: Who) => isResellerSide(me),
  /** Markup % is shown to admin (edit) and staff (read-only); never to resellers. */
  canSeeMarkup: (me: Who) => isTenant(me) && can(me?.permissions, "resellers"),
  canChangeMarkup: (me: Who) => me?.role === "admin" && can(me.permissions, "resellers", "manage"),
  canManageResellers: (me: Who) => isTenant(me) && can(me?.permissions, "resellers", "manage"),
  canSeeSupplierCost: (me: Who) => isTenant(me),
  canEditPlans: (me: Who) => me?.role === "admin" && can(me.permissions, "plans", "manage"),
  canEditDiscounts: (me: Who) => me?.role === "admin" && can(me.permissions, "discounts", "manage"),
  canSyncPriceList: (me: Who) => me?.role === "admin" && can(me.permissions, "price_lists", "manage"),
  canSell: (me: Who) => can(me?.permissions, "sell_esim", "manage"),
  canManageEsims: (me: Who) => can(me?.permissions, "esims", "manage"),
  /** Extend expiry, add data, block/unblock a plan: admin and staff. */
  canManagePlansOnEsim: (me: Who) => isTenant(me) && can(me?.permissions, "esims", "manage"),
  canSetEndOfLife: (me: Who) => me?.role === "admin" && can(me.permissions, "esims", "manage"),
  canDeletePlans: (me: Who) => me?.role === "admin" && can(me.permissions, "esims", "manage"),
  /** Resellers and assistants lift only their own suspensions (D57). */
  canReactivate: (me: Who, suspendedBy: "reseller" | "admin" | "rule" | null) =>
    can(me?.permissions, "esims", "manage") && (isTenant(me) || suspendedBy === "reseller"),
  canCheckOrder: (me: Who) => isTenant(me) && can(me?.permissions, "esims", "manage"),
  canResolveOrder: (me: Who) => me?.role === "admin",
  canAdjustWallet: (me: Who) => me?.role === "admin" && can(me.permissions, "wallets", "manage"),
  canApproveTopups: (me: Who) => isTenant(me) && can(me?.permissions, "topup_requests", "manage"),
  canRequestTopup: (me: Who) => isResellerSide(me) && can(me?.permissions, "topup_requests", "manage"),
  canCancelWaitingPlan: (me: Who) => can(me?.permissions, "sell_esim", "manage"),
  canEditResellerPlans: (me: Who) => isResellerSide(me) && can(me?.permissions, "reseller_plans", "manage"),
  canManageTeam: (me: Who) => me?.role === "reseller" && can(me.permissions, "team", "manage"),
  /** Admin emergency disable of any assistant (D94). */
  canDisableAnyAssistant: (me: Who) => me?.role === "admin" && can(me.permissions, "assistants"),
  canManageCustomers: (me: Who) => can(me?.permissions, "customers", "manage"),
};
