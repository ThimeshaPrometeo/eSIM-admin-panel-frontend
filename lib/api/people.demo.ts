/**
 * Demo resellers, customers and assistants (spec 8.15–8.17). Resellers exist
 * only in our platform: creating one never involves the supplier. Markup is
 * admin only and audit-logged; resellers never see any markup.
 */
import { ApiError } from "./errors";
import { creditWallet, debitWallet } from "@/lib/demo/billing";
import { meFor, resellerView } from "@/lib/demo/derive";
import { sendInvitation } from "@/lib/demo/invite";
import type { DReseller, DUser } from "@/lib/demo/model";
import { read, write } from "@/lib/demo/run";
import { assertScope, audit, authorize, inScope, requireRole, resellerAudience, notify, nowIso } from "@/lib/demo/session";
import { formatMoney, money } from "@/lib/platform/money";
import { effectivePermissions, rules } from "@/lib/platform/permissions";
import { clampToEnvelope, RESELLER_MATRIX, type Grants } from "@/lib/platform/permission-matrix";
import type { Assistant, AuditEntry, Customer, DocumentRow, Invitation, PermissionContext, Reseller } from "@/lib/platform/types";

export type ResellerInput = { companyName: string; contactName: string; email: string; phone: string; username: string; markupPercent: number | null };
export type ResellerUpdate = { companyName: string; contactName: string; email: string; phone: string };
export type AssistantInput = { fullName: string; username: string; email: string; grants: Grants };

function assistantView(s: Parameters<typeof resellerView>[0], u: DUser): Assistant {
  return {
    id: u.id,
    resellerId: u.resellerId!,
    resellerName: s.resellers.find((r) => r.id === u.resellerId)?.companyName ?? "",
    fullName: u.fullName,
    username: u.username,
    email: u.email,
    status: u.status,
    invited: u.invitePending,
    grants: u.grants,
    lastSignInAt: u.lastSignInAt,
    createdAt: u.createdAt,
  };
}

const usernameTaken = (s: Parameters<typeof resellerView>[0], username: string) => s.users.some((u) => u.username === username.toLowerCase());

export const demoPeople = {
  // -------------------------------------------------------------- resellers
  listResellers: (filters: { q?: string; status?: "active" | "suspended" | null } = {}) =>
    read((): Reseller[] => {
      const c = authorize("resellers");
      const q = filters.q?.trim().toLowerCase();
      return c.s.resellers
        .filter((r) => (!filters.status || r.status === filters.status) && (!q || r.companyName.toLowerCase().includes(q) || r.contactName.toLowerCase().includes(q)))
        .map((r) => resellerView(c.s, r, rules.canSeeMarkup(c.me)));
    }),
  /** Names only, for filters and pickers (admin/staff). */
  listResellerOptions: () =>
    read(() => {
      const c = authorize(["resellers", "dashboard", "discounts", "wallets", "transactions", "esims"]);
      if (!c.tenant) return [];
      return c.s.resellers.map((r) => ({ id: r.id, name: r.companyName, status: r.status }));
    }),
  getReseller: (id: string) =>
    read((): Reseller => {
      const c = authorize("resellers");
      const r = c.s.resellers.find((x) => x.id === id);
      if (!r) throw new ApiError(404, "NOT_FOUND");
      return resellerView(c.s, r, rules.canSeeMarkup(c.me));
    }),
  createReseller: (input: ResellerInput) =>
    write((): Reseller & { invitation: Invitation } => {
      const c = authorize("resellers", "manage");
      requireRole(c, "admin", "staff");
      const username = input.username.trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw new ApiError(400, "INVALID_USERNAME", "Use 3–32 letters, numbers, dots, dashes or underscores.");
      if (usernameTaken(c.s, username)) throw new ApiError(409, "USERNAME_TAKEN");
      const id = `r${++c.s.seq}`;
      const r: DReseller = {
        id,
        companyName: input.companyName.trim(),
        contactName: input.contactName.trim(),
        email: input.email.trim(),
        phone: input.phone.trim(),
        status: "active",
        // only admins set the markup; otherwise the tenant default applies (D76)
        markupPercent: c.me.role === "admin" && input.markupPercent !== null ? input.markupPercent : c.s.settings.defaultMarkupPercent,
        createdAt: nowIso(),
      };
      c.s.resellers.push(r);
      c.s.markupHistory.push({ id: `mh${++c.s.seq}`, resellerId: id, effectiveAt: nowIso(), markupPercent: r.markupPercent, previousPercent: null, changedAt: nowIso(), changedBy: c.u.id, reason: "Starting markup" });
      c.s.wallets.push({ id: `w-${id}`, kind: "reseller", resellerId: id, balance: 0, outstanding: 0, lowThreshold: c.s.settings.lowWalletThreshold });
      const first: DUser = {
        id: `u-${id}`,
        username,
        fullName: r.contactName,
        email: r.email,
        role: "reseller",
        resellerId: id,
        staffRoleId: null,
        grants: {},
        status: "active",
        locked: false,
        mfaEnrolled: false,
        mfaEnrolledAt: null,
        recoveryCodesLeft: 0,
        passkeys: [],
        lockedUntil: null,
        mustChangePassword: false,
        invitePending: true,
        lastSignInAt: null,
        createdAt: nowIso(),
      };
      c.s.users.push(first);
      const invitation = sendInvitation(c.s, first);
      audit(c, "reseller.created", "reseller", id, `Reseller ${r.companyName} created with markup ${r.markupPercent}%; invitation sent to ${first.email}`, id);
      return { ...resellerView(c.s, r, rules.canSeeMarkup(c.me)), invitation };
    }),
  updateReseller: (id: string, input: ResellerUpdate) =>
    write(() => {
      const c = authorize("resellers", "manage");
      const r = c.s.resellers.find((x) => x.id === id);
      if (!r) throw new ApiError(404, "NOT_FOUND");
      Object.assign(r, { companyName: input.companyName.trim(), contactName: input.contactName.trim(), email: input.email.trim(), phone: input.phone.trim() });
      audit(c, "reseller.updated", "reseller", id, "Contact details updated", id);
    }),
  setResellerStatus: (id: string, input: { status: "active" | "suspended"; reason: string }) =>
    write(() => {
      const c = authorize("resellers", "manage");
      const r = c.s.resellers.find((x) => x.id === id);
      if (!r) throw new ApiError(404, "NOT_FOUND");
      r.status = input.status;
      audit(c, "reseller.status_changed", "reseller", id, `${input.status === "suspended" ? "Suspended" : "Reactivated"}: ${input.reason}`, id);
    }),
  /** Admin only, audit-logged, applies to usage rated from now (D76). */
  setResellerMarkup: (id: string, input: { markupPercent: number; reason: string }) =>
    write(() => {
      const c = authorize("resellers", "manage");
      requireRole(c, "admin");
      const r = c.s.resellers.find((x) => x.id === id);
      if (!r) throw new ApiError(404, "NOT_FOUND");
      if (input.markupPercent < 0 || input.markupPercent > 500) throw new ApiError(400, "INVALID_MARKUP", "Use a markup between 0% and 500%.");
      audit(c, "reseller.markup_changed", "reseller", id, `Markup changed from ${r.markupPercent}% to ${input.markupPercent}%${input.reason ? `: ${input.reason}` : ""}`, id, [{ field: "Markup", before: `${r.markupPercent}%`, after: `${input.markupPercent}%` }]);
      c.s.markupHistory.push({
        id: `mh${++c.s.seq}`,
        resellerId: id,
        effectiveAt: nowIso(),
        markupPercent: input.markupPercent,
        previousPercent: r.markupPercent,
        changedAt: nowIso(),
        changedBy: c.u.id,
        reason: input.reason,
      });
      r.markupPercent = input.markupPercent;
    }),
  /** Admin credit (or debit) to a reseller wallet from the reseller page. A credit runs the funding queue. */
  adjustResellerWallet: (id: string, input: { direction: "credit" | "debit"; amount: number; description: string }) =>
    write(() => {
      const c = authorize("wallets", "manage");
      requireRole(c, "admin");
      const w = c.s.wallets.find((x) => x.resellerId === id);
      if (!w) throw new ApiError(404, "NOT_FOUND");
      const reference = `ADJ-${String(++c.s.seq).padStart(5, "0")}`;
      if (input.direction === "debit") {
        debitWallet(c.s, w, input.amount, { reference, description: input.description });
        audit(c, "wallet.adjusted", "wallet", w.id, `Debit ${formatMoney(input.amount)}: ${input.description}`, id);
        return { outstandingPaid: 0, plansFunded: 0 };
      }
      const effect = creditWallet(c.s, w, input.amount, { type: "adjustment", reference, description: input.description });
      audit(c, "wallet.adjusted", "wallet", w.id, `Credit ${formatMoney(input.amount)}: ${input.description}`, id);
      notify(c.s, resellerAudience(c.s, id), "Wallet credited", `${formatMoney(input.amount)} was added to your wallet.`, "/esim/wallet");
      return effect;
    }),
  listResellerAudit: (id: string) =>
    read((): AuditEntry[] => {
      const c = authorize("resellers");
      return c.s.audit
        .filter((a) => a.resellerId === id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((a) => ({ id: a.id, actor: c.s.users.find((u) => u.id === a.actorId)?.fullName ?? "System", action: a.action, summary: a.summary, createdAt: a.createdAt }));
    }),
  /** Documents tab: monthly statements and top-up receipts (demo rows; PDFs come with the invoices work). */
  listResellerDocuments: (id: string) =>
    read((): DocumentRow[] => {
      const c = authorize("resellers");
      const receipts = c.s.topups
        .filter((t) => t.resellerId === id && t.receiptNumber)
        .map((t) => ({ id: t.id, number: t.receiptNumber!, kind: "receipt" as const, title: "Top-up receipt", amount: money(t.amount), issuedAt: t.decidedAt! }));
      const months = [1, 2, 3].map((m) => {
        const d = new Date();
        d.setUTCDate(1);
        d.setUTCMonth(d.getUTCMonth() - m);
        const label = d.toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
        const charges = c.s.ledger
          .filter((l) => l.walletId === `w-${id}` && l.type === "usage_charge" && l.createdAt.slice(0, 7) === d.toISOString().slice(0, 7))
          .reduce((a, l) => a - l.amount, 0);
        return { id: `st-${id}-${m}`, number: `ST-${d.getUTCFullYear()}-${String(40 + m * 7 + Number(id.replace(/\D/g, "") || 1)).padStart(4, "0")}`, kind: "statement" as const, title: `Statement, ${label}`, amount: money(charges), issuedAt: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 3)).toISOString() };
      });
      return [...months, ...receipts].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
    }),

  // -------------------------------------------------------------- customers
  listCustomers: (filters: { q?: string; resellerId?: string | null } = {}) =>
    read((): Customer[] => {
      const c = authorize(["customers", "sell_esim"]);
      const q = filters.q?.trim().toLowerCase();
      return c.s.customers
        .filter((x) => inScope(c, x.resellerId) && (c.tenant ? (filters.resellerId === undefined ? true : x.resellerId === filters.resellerId) : true))
        .filter((x) => !q || x.name.toLowerCase().includes(q) || x.email.toLowerCase().includes(q))
        .map((x) => ({
          id: x.id,
          name: x.name,
          email: x.email,
          phone: x.phone,
          resellerId: x.resellerId,
          resellerName: x.resellerId ? (c.s.resellers.find((r) => r.id === x.resellerId)?.companyName ?? null) : null,
          esimCount: c.s.esims.filter((e) => e.customerId === x.id).length,
          createdAt: x.createdAt,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }),
  createCustomer: (input: { name: string; email: string; phone: string }) =>
    write((): Customer => {
      const c = authorize(["customers", "sell_esim"], "manage");
      if (!input.name.trim()) throw new ApiError(400, "NAME_REQUIRED", "Enter the customer's name.");
      const x = { id: `c${++c.s.seq}`, name: input.name.trim(), email: input.email.trim(), phone: input.phone.trim(), resellerId: c.resellerId, createdAt: nowIso() };
      c.s.customers.push(x);
      return { ...x, resellerName: c.resellerId ? (c.s.resellers.find((r) => r.id === c.resellerId)?.companyName ?? null) : null, esimCount: 0 };
    }),

  // ------------------------------------------------------------- assistants
  listAssistants: (filters: { resellerId?: string | null } = {}) =>
    read((): Assistant[] => {
      const c = authorize(["assistants", "team"]);
      return c.s.users
        .filter((u) => u.role === "assistant" && inScope(c, u.resellerId) && (!filters.resellerId || u.resellerId === filters.resellerId))
        .map((u) => assistantView(c.s, u))
        .sort((a, b) => a.resellerName.localeCompare(b.resellerName) || a.fullName.localeCompare(b.fullName));
    }),
  /** What a reseller may grant: their own effective permissions (the matrix greys out the rest). */
  getPermissionContext: () =>
    read((): PermissionContext => {
      const c = authorize(["team", "assistants"]);
      const envelope = c.resellerId ? meFor(c.s, c.s.users.find((u) => u.role === "reseller" && u.resellerId === c.resellerId)!).permissions : effectivePermissions({ role: "reseller" });
      return { envelope, resellerName: c.me.resellerName };
    }),
  createAssistant: (input: AssistantInput) =>
    write((): Assistant & { invitation: Invitation } => {
      const c = authorize("team", "manage");
      requireRole(c, "reseller");
      const username = input.username.trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw new ApiError(400, "INVALID_USERNAME", "Use 3–32 letters, numbers, dots, dashes or underscores.");
      if (usernameTaken(c.s, username)) throw new ApiError(409, "USERNAME_TAKEN");
      const u: DUser = {
        id: `u${++c.s.seq}`,
        username,
        fullName: input.fullName.trim(),
        email: input.email.trim(),
        role: "assistant",
        resellerId: c.resellerId,
        staffRoleId: null,
        grants: clampToEnvelope(input.grants, RESELLER_MATRIX, c.me.permissions),
        status: "active",
        locked: false,
        mfaEnrolled: false,
        mfaEnrolledAt: null,
        recoveryCodesLeft: 0,
        passkeys: [],
        lockedUntil: null,
        mustChangePassword: false,
        invitePending: true,
        lastSignInAt: null,
        createdAt: nowIso(),
      };
      c.s.users.push(u);
      const invitation = sendInvitation(c.s, u);
      audit(c, "assistant.created", "user", u.id, `Assistant ${u.fullName} created; invitation sent to ${u.email}`, c.resellerId);
      return { ...assistantView(c.s, u), invitation };
    }),
  setAssistantPermissions: (id: string, grants: Grants) =>
    write(() => {
      const c = authorize("team", "manage");
      requireRole(c, "reseller");
      const u = c.s.users.find((x) => x.id === id && x.role === "assistant");
      if (!u) throw new ApiError(404, "NOT_FOUND");
      assertScope(c, u.resellerId);
      u.grants = clampToEnvelope(grants, RESELLER_MATRIX, c.me.permissions);
      audit(c, "assistant.permissions_changed", "user", u.id, `Permissions of ${u.fullName} changed`, u.resellerId);
    }),
  updateAssistant: (id: string, input: { fullName: string; email: string }) =>
    write(() => {
      const c = authorize("team", "manage");
      requireRole(c, "reseller");
      const u = c.s.users.find((x) => x.id === id && x.role === "assistant");
      if (!u) throw new ApiError(404, "NOT_FOUND");
      assertScope(c, u.resellerId);
      u.fullName = input.fullName.trim();
      u.email = input.email.trim();
    }),
  /** Resellers: own assistants. Admins: any assistant, immediately (D94), with a reason. */
  setAssistantStatus: (id: string, input: { status: "active" | "disabled"; reason?: string }) =>
    write(() => {
      const c = authorize(["team", "assistants"]);
      const u = c.s.users.find((x) => x.id === id && x.role === "assistant");
      if (!u) throw new ApiError(404, "NOT_FOUND");
      if (c.me.role === "reseller") assertScope(c, u.resellerId);
      else if (c.me.role !== "admin") throw new ApiError(403, "FORBIDDEN");
      if (c.me.role === "reseller" && !rules.canManageTeam(c.me)) throw new ApiError(403, "FORBIDDEN");
      u.status = input.status;
      if (c.s.session.userId === u.id && input.status === "disabled") c.s.session.userId = null;
      audit(c, input.status === "disabled" ? "assistant.disabled" : "assistant.enabled", "user", u.id, `Assistant ${u.fullName} ${input.status === "disabled" ? "disabled" : "enabled"}${input.reason ? `: ${input.reason}` : ""}`, u.resellerId);
      if (c.me.role === "admin" && u.resellerId) notify(c.s, resellerAudience(c.s, u.resellerId), `${u.fullName} was ${input.status === "disabled" ? "disabled" : "enabled"} by an administrator`, input.reason ?? "", "/esim/assistants");
    }),
};

export type PeopleApi = typeof demoPeople;
