import { apiFetch } from "./client";
import type { AccountsApi } from "./accounts.demo";
import type { AuditRecord, Invitation, MySecurity, Page, StaffRole, TotpSetup, UserAccount } from "@/lib/platform/types";

/** Users, staff roles, audit log, profile and security; gaps are in backend-backlog.md (BB-26 to BB-29). */
export const httpAccounts: AccountsApi = {
  listUsers: (f = {}) => apiFetch<Page<UserAccount>>("/users", { query: { q: f.q, role: f.role, state: f.state, pageSize: 100 } }).then((p) => p.data),
  createStaffUser: (input) => apiFetch<{ user: UserAccount; invitation: Invitation }>("/users", { method: "POST", body: { ...input, role: "staff" } }),
  resendInvitation: (id) => apiFetch<Invitation>(`/users/${id}/invitation`, { method: "POST" }),
  setUserStatus: (id, status, reason) => apiFetch<UserAccount>(`/users/${id}/status`, { method: "POST", body: { status, reason } }),
  unlockUser: (id) => apiFetch<UserAccount>(`/users/${id}/unlock`, { method: "POST" }),
  resetUserMfa: (id, reason) => apiFetch<UserAccount>(`/users/${id}/mfa/reset`, { method: "POST", body: { reason } }),
  changeUsername: (id, username) => apiFetch<UserAccount>(`/users/${id}/username`, { method: "POST", body: { username } }),
  setStaffRoleOfUser: (id, staffRoleId) => apiFetch<UserAccount>(`/users/${id}`, { method: "PATCH", body: { staffRoleId } }),
  listStaffRoles: () => apiFetch<Page<StaffRole>>("/staff-roles").then((p) => p.data),
  saveStaffRole: (id, input) => (id ? apiFetch<StaffRole>(`/staff-roles/${id}`, { method: "PATCH", body: input }) : apiFetch<StaffRole>("/staff-roles", { method: "POST", body: input })),
  deleteStaffRole: (id) => apiFetch<void>(`/staff-roles/${id}`, { method: "DELETE" }),
  listAudit: (f = {}) =>
    apiFetch<{ rows: AuditRecord[]; options: { actors: { id: string; name: string }[]; entityTypes: string[]; actions: string[] } }>("/audit-log", {
      query: { q: f.q, actorId: f.actorId, entityType: f.entityType, action: f.action, from: f.from, to: f.to },
    }),
  getMySecurity: () => apiFetch<MySecurity>("/auth/me/security"),
  updateProfile: (input) => apiFetch<MySecurity>("/auth/me", { method: "PATCH", body: input }),
  startTotpSetup: () => apiFetch<TotpSetup>("/auth/mfa/totp/setup", { method: "POST" }),
  confirmTotp: (code) => apiFetch<{ recoveryCodes: string[] }>("/auth/mfa/totp/enable", { method: "POST", body: { code } }),
  regenerateRecoveryCodes: (code) => apiFetch<{ recoveryCodes: string[] }>("/auth/mfa/recovery-codes", { method: "POST", body: { code } }),
  addPasskey: (name) => apiFetch<MySecurity>("/auth/passkeys", { method: "POST", body: { name } }),
  renamePasskey: (id, name) => apiFetch<MySecurity>(`/auth/passkeys/${id}`, { method: "PATCH", body: { name } }),
  removePasskey: (id) => apiFetch<MySecurity>(`/auth/passkeys/${id}`, { method: "DELETE" }),
  signOutEverywhere: () => apiFetch<void>("/auth/logout-all", { method: "POST" }),
};
