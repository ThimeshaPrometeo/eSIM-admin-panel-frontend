/**
 * Who is calling, for demo API functions: the signed-in demo user, their
 * effective permissions and data scope, applied exactly like the backend
 * (out of scope = 404, missing permission = 403).
 */
import { ApiError } from "@/lib/api/errors";
import { can } from "@/lib/platform/permissions";
import type { Level } from "@/lib/platform/permission-matrix";
import type { Me, Module } from "@/lib/platform/types";
import { meFor } from "./derive";
import { demoIp } from "./ip";
import type { DAudit, DState, DUser } from "./model";
import { db } from "./store";

export type Caller = { s: DState; u: DUser; me: Me; tenant: boolean; resellerId: string | null };

export function caller(): Caller {
  const s = db();
  const u = s.users.find((x) => x.id === s.session.userId);
  if (!u || u.status !== "active") throw new ApiError(401, "UNAUTHENTICATED");
  const me = meFor(s, u);
  return { s, u, me, tenant: me.role === "admin" || me.role === "staff", resellerId: u.resellerId };
}

/** Caller with at least `level` on any of the modules. */
export function authorize(modules: Module | Module[], level: Level = "view"): Caller {
  const c = caller();
  const list = Array.isArray(modules) ? modules : [modules];
  if (!list.some((m) => can(c.me.permissions, m, level))) throw new ApiError(403, "FORBIDDEN");
  return c;
}

export function requireRole(c: Caller, ...roles: Me["role"][]) {
  if (!roles.includes(c.me.role)) throw new ApiError(403, "FORBIDDEN");
}

export function inScope(c: Caller, resellerId: string | null) {
  return c.tenant || (resellerId !== null && resellerId === c.resellerId);
}

export function assertScope(c: Caller, resellerId: string | null) {
  if (!inScope(c, resellerId)) throw new ApiError(404, "NOT_FOUND");
}

export function nowIso() {
  return new Date().toISOString();
}

export function audit(c: Caller, action: string, entityType: string, entityId: string, summary: string, resellerId: string | null, changes: DAudit["changes"] = null) {
  c.s.audit.unshift({ id: `a${++c.s.seq}`, actorId: c.u.id, action, entityType, entityId, summary, resellerId, createdAt: nowIso(), ip: demoIp(c.u.id), changes });
}

export function notify(s: DState, userIds: string[], title: string, body: string, href: string | null) {
  for (const userId of userIds) s.notifications.unshift({ id: `n${++s.seq}`, userId, title, body, href, createdAt: nowIso(), read: false });
}

/** Users who should hear about a reseller's wallet (the reseller and assistants with wallet access). */
export function resellerAudience(s: DState, resellerId: string) {
  return s.users.filter((u) => u.resellerId === resellerId && u.status === "active" && (u.role === "reseller" || u.grants.wallets)).map((u) => u.id);
}

export function tenantAudience(s: DState) {
  return s.users.filter((u) => (u.role === "admin" || u.role === "staff") && u.status === "active").map((u) => u.id);
}

export function paginate<T>(rows: T[], page = 1, pageSize = 25) {
  const size = Math.min(100, Math.max(1, pageSize));
  const p = Math.max(1, page);
  return { data: rows.slice((p - 1) * size, p * size), page: p, pageSize: size, total: rows.length };
}
