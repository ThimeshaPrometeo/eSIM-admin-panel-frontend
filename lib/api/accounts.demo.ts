/**
 * Demo accounts (spec 8.24 users, 8.25 staff roles, 8.28 audit log, 8.30
 * profile and security). Rules follow the backend: admins change usernames;
 * staff can't change admin accounts; nobody disables or locks out themselves;
 * every account keeps at least one way to confirm sign-in.
 */
import { ApiError } from "./errors";
import type { DState, DUser } from "@/lib/demo/model";
import { createRng } from "@/lib/demo/rng";
import { read, write } from "@/lib/demo/run";
import { audit, authorize, caller, nowIso, requireRole, type Caller } from "@/lib/demo/session";
import { clampToEnvelope, levelOf, STAFF_MATRIX, type Grants } from "@/lib/platform/permission-matrix";
import { ROLE_ENVELOPES } from "@/lib/platform/permissions";
import type { AuditRecord, MySecurity, Role, StaffRole, TotpSetup, UserAccount } from "@/lib/platform/types";

const USERNAME = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export type UserFilters = { q?: string; role?: Role | null; state?: "active" | "disabled" | "locked" | "no_app" | null };
export type AuditFilters = { q?: string; actorId?: string | null; entityType?: string | null; action?: string | null; from?: string | null; to?: string | null };
export type StaffUserInput = { fullName: string; username: string; email: string; staffRoleId: string };

function isLocked(u: DUser) {
  return u.locked && (!u.lockedUntil || u.lockedUntil > nowIso());
}

function userView(s: DState, u: DUser): UserAccount {
  return {
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    resellerId: u.resellerId,
    resellerName: u.resellerId ? (s.resellers.find((r) => r.id === u.resellerId)?.companyName ?? null) : null,
    staffRoleId: u.staffRoleId,
    staffRoleName: u.staffRoleId ? (s.staffRoles.find((r) => r.id === u.staffRoleId)?.name ?? null) : null,
    status: u.status,
    locked: isLocked(u),
    lockedUntil: isLocked(u) ? u.lockedUntil : null,
    mfaApp: u.mfaEnrolled,
    passkeys: u.passkeys.length,
    mustChangePassword: u.mustChangePassword,
    lastSignInAt: u.lastSignInAt,
    createdAt: u.createdAt,
  };
}

function roleView(s: DState, r: DState["staffRoles"][number]): StaffRole {
  return { id: r.id, name: r.name, grants: r.grants, members: s.users.filter((u) => u.staffRoleId === r.id).map((u) => ({ id: u.id, fullName: u.fullName })) };
}

function auditView(s: DState, a: DState["audit"][number]): AuditRecord {
  const actor = a.actorId ? s.users.find((u) => u.id === a.actorId) : null;
  return {
    id: a.id,
    at: a.createdAt,
    actorId: a.actorId,
    actorName: actor?.fullName ?? "System",
    actorUsername: actor?.username ?? null,
    action: a.action,
    entityType: a.entityType,
    entityId: a.entityId,
    summary: a.summary,
    resellerName: a.resellerId ? (s.resellers.find((r) => r.id === a.resellerId)?.companyName ?? null) : null,
    ip: a.ip ?? null,
    changes: a.changes ?? null,
  };
}

/** Staff can't change admin accounts; nobody changes their own status here. */
function target(c: Caller, id: string) {
  const u = c.s.users.find((x) => x.id === id);
  if (!u) throw new ApiError(404, "NOT_FOUND");
  if (u.role === "admin" && c.me.role !== "admin") throw new ApiError(403, "ADMIN_ACCOUNT", "Only an administrator can change an administrator's account.");
  return u;
}

function randomFrom(alphabet: string, n: number, seed: number) {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => alphabet[rng.int(0, alphabet.length - 1)]).join("");
}
function seedOf(s: DState) {
  return (Date.now() % 1_000_000_007) + ++s.seq * 7919;
}
function recoveryCodes(s: DState) {
  const seed = seedOf(s);
  return Array.from({ length: 10 }, (_, i) => {
    const raw = randomFrom("abcdefghjkmnpqrstuvwxyz23456789", 8, seed + i * 104729);
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });
}

function security(u: DUser): MySecurity {
  return {
    username: u.username,
    fullName: u.fullName,
    email: u.email,
    app: { enabled: u.mfaEnrolled, enabledAt: u.mfaEnrolledAt, recoveryCodesLeft: u.mfaEnrolled ? u.recoveryCodesLeft : 0 },
    passkeys: u.passkeys.map((p) => ({ ...p })),
    lastSignInAt: u.lastSignInAt,
  };
}

const sixDigits = (code: string) => {
  if (!/^\d{6}$/.test(code.trim())) throw new ApiError(400, "INVALID_CODE", "Enter the 6-digit code from your authenticator app.");
};

export const demoAccounts = {
  // ----------------------------------------------------------------- users
  listUsers: (f: UserFilters = {}) =>
    read((): UserAccount[] => {
      const c = authorize("users");
      const q = f.q?.trim().toLowerCase();
      return c.s.users
        .filter((u) => !q || u.fullName.toLowerCase().includes(q) || u.username.includes(q) || u.email.toLowerCase().includes(q))
        .filter((u) => !f.role || u.role === f.role)
        .filter((u) => !f.state || (f.state === "locked" ? isLocked(u) : f.state === "no_app" ? !u.mfaEnrolled : u.status === f.state))
        .map((u) => userView(c.s, u))
        .sort((a, b) => a.fullName.localeCompare(b.fullName));
    }),
  /** A new staff member: signs in with the temporary password (shown once), then sets their own and their 2FA. */
  createStaffUser: (input: StaffUserInput) =>
    write((): { user: UserAccount; temporaryPassword: string } => {
      const c = authorize("users", "manage");
      requireRole(c, "admin", "staff");
      const username = input.username.trim().toLowerCase();
      if (!input.fullName.trim()) throw new ApiError(400, "NAME_REQUIRED", "Enter their full name.");
      if (!USERNAME.test(username)) throw new ApiError(400, "INVALID_USERNAME", "Use 3–32 lowercase letters, numbers, dots, dashes or underscores.");
      if (c.s.users.some((u) => u.username === username)) throw new ApiError(409, "USERNAME_TAKEN", "That username is taken.");
      if (!EMAIL.test(input.email.trim())) throw new ApiError(400, "INVALID_EMAIL", "Enter a valid email address.");
      if (!c.s.staffRoles.some((r) => r.id === input.staffRoleId)) throw new ApiError(400, "ROLE_REQUIRED", "Choose a staff role.");
      const u: DUser = {
        id: `u${++c.s.seq}`,
        username,
        fullName: input.fullName.trim(),
        email: input.email.trim(),
        role: "staff",
        resellerId: null,
        staffRoleId: input.staffRoleId,
        grants: {},
        status: "active",
        locked: false,
        lockedUntil: null,
        mfaEnrolled: false,
        mfaEnrolledAt: null,
        recoveryCodesLeft: 0,
        passkeys: [],
        mustChangePassword: true,
        lastSignInAt: null,
        createdAt: nowIso(),
      };
      c.s.users.push(u);
      const role = c.s.staffRoles.find((r) => r.id === u.staffRoleId)!.name;
      audit(c, "user.created", "user", u.id, `Staff user ${u.fullName} created (${role})`, null);
      const temporaryPassword = `${randomFrom("ABCDEFGHJKLMNPQRSTUVWXYZ", 4, seedOf(c.s))}-${randomFrom("23456789abcdefghjkmnpqrstuvwxyz", 6, seedOf(c.s))}`;
      return { user: userView(c.s, u), temporaryPassword };
    }),
  setUserStatus: (id: string, status: "active" | "disabled", reason: string) =>
    write((): UserAccount => {
      const c = authorize("users", "manage");
      requireRole(c, "admin", "staff");
      const u = target(c, id);
      if (u.id === c.u.id) throw new ApiError(409, "SELF", "You can't disable your own account.");
      const before = u.status;
      u.status = status;
      audit(c, status === "disabled" ? "user.disabled" : "user.enabled", "user", u.id, `${u.fullName} ${status === "disabled" ? "disabled" : "enabled"}${reason.trim() ? `: ${reason.trim()}` : ""}`, u.resellerId, [
        { field: "Status", before: before === "active" ? "Active" : "Disabled", after: status === "active" ? "Active" : "Disabled" },
      ]);
      return userView(c.s, u);
    }),
  unlockUser: (id: string) =>
    write((): UserAccount => {
      const c = authorize("users", "manage");
      requireRole(c, "admin", "staff");
      const u = target(c, id);
      u.locked = false;
      u.lockedUntil = null;
      audit(c, "user.unlocked", "user", u.id, `${u.fullName} unlocked`, u.resellerId);
      return userView(c.s, u);
    }),
  /** Lost phone: removes the authenticator app, recovery codes and passkeys; they set 2FA up again at next sign-in. */
  resetUserMfa: (id: string, reason: string) =>
    write((): UserAccount => {
      const c = authorize("users", "manage");
      requireRole(c, "admin", "staff");
      if (reason.trim().length < 3) throw new ApiError(400, "REASON_REQUIRED", "Say why. It's kept in the audit log.");
      const u = target(c, id);
      if (u.id === c.u.id) throw new ApiError(409, "SELF", "Reset your own 2FA from Profile and security.");
      const before = `${u.mfaEnrolled ? "Authenticator app" : "No app"}, ${u.passkeys.length} passkey${u.passkeys.length === 1 ? "" : "s"}`;
      u.mfaEnrolled = false;
      u.mfaEnrolledAt = null;
      u.recoveryCodesLeft = 0;
      u.passkeys = [];
      audit(c, "user.mfa_reset", "user", u.id, `2FA reset for ${u.fullName}: ${reason.trim()}`, u.resellerId, [{ field: "Two-factor", before, after: "None (set up at next sign-in)" }]);
      return userView(c.s, u);
    }),
  changeUsername: (id: string, username: string) =>
    write((): UserAccount => {
      const c = authorize("users", "manage");
      requireRole(c, "admin");
      const u = target(c, id);
      const next = username.trim().toLowerCase();
      if (!USERNAME.test(next)) throw new ApiError(400, "INVALID_USERNAME", "Use 3–32 lowercase letters, numbers, dots, dashes or underscores.");
      if (next === u.username) return userView(c.s, u);
      if (c.s.users.some((x) => x.username === next)) throw new ApiError(409, "USERNAME_TAKEN", "That username is taken.");
      const before = u.username;
      u.username = next;
      audit(c, "user.username_changed", "user", u.id, `Username of ${u.fullName} changed`, u.resellerId, [{ field: "Username", before, after: next }]);
      return userView(c.s, u);
    }),
  setStaffRoleOfUser: (id: string, staffRoleId: string) =>
    write((): UserAccount => {
      const c = authorize("users", "manage");
      requireRole(c, "admin");
      const u = target(c, id);
      if (u.role !== "staff") throw new ApiError(409, "NOT_STAFF");
      const role = c.s.staffRoles.find((r) => r.id === staffRoleId);
      if (!role) throw new ApiError(404, "NOT_FOUND");
      const before = c.s.staffRoles.find((r) => r.id === u.staffRoleId)?.name ?? "—";
      u.staffRoleId = role.id;
      audit(c, "user.role_changed", "user", u.id, `${u.fullName} moved to ${role.name}`, null, [{ field: "Staff role", before, after: role.name }]);
      return userView(c.s, u);
    }),

  // ----------------------------------------------------------- staff roles
  listStaffRoles: () =>
    read((): StaffRole[] => {
      const c = authorize(["staff_roles", "users"]);
      return c.s.staffRoles.map((r) => roleView(c.s, r)).sort((a, b) => a.name.localeCompare(b.name));
    }),
  saveStaffRole: (id: string | null, input: { name: string; grants: Grants }) =>
    write((): StaffRole => {
      const c = authorize("staff_roles", "manage");
      requireRole(c, "admin");
      const name = input.name.trim();
      if (name.length < 2) throw new ApiError(400, "NAME_REQUIRED", "Name the role, e.g. Support.");
      if (c.s.staffRoles.some((r) => r.id !== id && r.name.toLowerCase() === name.toLowerCase())) throw new ApiError(409, "NAME_TAKEN", "A role with this name exists.");
      // modules without a row in the matrix (e.g. reseller plans, view only) keep their grant
      const existing = id ? (c.s.staffRoles.find((x) => x.id === id)?.grants ?? {}) : {};
      const inMatrix = new Set(STAFF_MATRIX.flatMap((sec) => sec.rows.map((r) => r.module)));
      const grants: Grants = { ...Object.fromEntries(Object.entries(existing).filter(([m]) => !inMatrix.has(m))), ...clampToEnvelope(input.grants, STAFF_MATRIX, ROLE_ENVELOPES.staff) };
      if (!id) {
        const r = { id: `sr${++c.s.seq}`, name, grants };
        c.s.staffRoles.push(r);
        audit(c, "staff_role.created", "staff_role", r.id, `Staff role ${name} created`, null);
        return roleView(c.s, r);
      }
      const r = c.s.staffRoles.find((x) => x.id === id);
      if (!r) throw new ApiError(404, "NOT_FOUND");
      const label = (l: string) => (l === "manage" ? "View and manage" : l === "view" ? "View" : "Off");
      const changes = STAFF_MATRIX.flatMap((sec) => sec.rows)
        .filter((row) => levelOf(r.grants, row.module) !== levelOf(grants, row.module))
        .map((row) => ({ field: row.label, before: label(levelOf(r.grants, row.module)), after: label(levelOf(grants, row.module)) }));
      if (r.name !== name) changes.unshift({ field: "Name", before: r.name, after: name });
      r.name = name;
      r.grants = grants;
      if (changes.length) audit(c, "staff_role.updated", "staff_role", r.id, `Staff role ${name} changed (${changes.length} change${changes.length === 1 ? "" : "s"})`, null, changes);
      return roleView(c.s, r);
    }),
  deleteStaffRole: (id: string) =>
    write(() => {
      const c = authorize("staff_roles", "manage");
      requireRole(c, "admin");
      const r = c.s.staffRoles.find((x) => x.id === id);
      if (!r) throw new ApiError(404, "NOT_FOUND");
      if (c.s.users.some((u) => u.staffRoleId === id)) throw new ApiError(409, "ROLE_IN_USE", "Move its members to another role first.");
      c.s.staffRoles = c.s.staffRoles.filter((x) => x.id !== id);
      audit(c, "staff_role.deleted", "staff_role", id, `Staff role ${r.name} deleted`, null);
    }),

  // ------------------------------------------------------------- audit log
  listAudit: (f: AuditFilters = {}) =>
    read((): { rows: AuditRecord[]; options: { actors: { id: string; name: string }[]; entityTypes: string[]; actions: string[] } } => {
      const c = authorize("audit_log");
      requireRole(c, "admin", "staff");
      const q = f.q?.trim().toLowerCase();
      const all = c.s.audit;
      const rows = all
        .filter((a) => (!f.actorId || (f.actorId === "system" ? a.actorId === null : a.actorId === f.actorId)) && (!f.entityType || a.entityType === f.entityType) && (!f.action || a.action === f.action))
        .filter((a) => (!f.from || a.createdAt.slice(0, 10) >= f.from) && (!f.to || a.createdAt.slice(0, 10) <= f.to))
        .filter((a) => !q || a.summary.toLowerCase().includes(q) || a.entityId.toLowerCase().includes(q))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((a) => auditView(c.s, a));
      const actorIds = [...new Set(all.map((a) => a.actorId).filter((x): x is string => !!x))];
      return {
        rows,
        options: {
          actors: actorIds.map((id) => ({ id, name: c.s.users.find((u) => u.id === id)?.fullName ?? id })).sort((a, b) => a.name.localeCompare(b.name)),
          entityTypes: [...new Set(all.map((a) => a.entityType))].sort(),
          actions: [...new Set(all.map((a) => a.action))].sort(),
        },
      };
    }),

  // ------------------------------------------------- my profile and security
  getMySecurity: () => read((): MySecurity => security(caller().u)),
  updateProfile: (input: { fullName: string; email: string }) =>
    write((): MySecurity => {
      const c = caller();
      if (input.fullName.trim().length < 2) throw new ApiError(400, "NAME_REQUIRED", "Enter your full name.");
      if (!EMAIL.test(input.email.trim())) throw new ApiError(400, "INVALID_EMAIL", "Enter a valid email address.");
      const changes = [
        { field: "Name", before: c.u.fullName, after: input.fullName.trim() },
        { field: "Email", before: c.u.email, after: input.email.trim() },
      ].filter((x) => x.before !== x.after);
      c.u.fullName = input.fullName.trim();
      c.u.email = input.email.trim();
      if (changes.length) audit(c, "user.profile_updated", "user", c.u.id, `${c.u.fullName} updated their profile`, c.u.resellerId, changes);
      return security(c.u);
    }),
  /** Step 1 of setting up an authenticator app: a new secret (not active until confirmed). */
  startTotpSetup: () =>
    write((): TotpSetup => {
      const c = caller();
      const secret = randomFrom(BASE32, 32, seedOf(c.s));
      c.s.mfaSetup = { userId: c.u.id, secret };
      const label = encodeURIComponent(`eSIM workspace:${c.u.username}`);
      return { secret, otpauthUri: `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent("eSIM workspace")}&algorithm=SHA1&digits=6&period=30` };
    }),
  /** Step 2: confirm with a code from the app. Returns the recovery codes, shown once. */
  confirmTotp: (code: string) =>
    write((): { recoveryCodes: string[] } => {
      const c = caller();
      if (!c.s.mfaSetup || c.s.mfaSetup.userId !== c.u.id) throw new ApiError(409, "NO_SETUP", "Start the set-up again.");
      sixDigits(code);
      const replacing = c.u.mfaEnrolled;
      c.u.mfaEnrolled = true;
      c.u.mfaEnrolledAt = nowIso();
      c.u.recoveryCodesLeft = 10;
      c.s.mfaSetup = null;
      audit(c, replacing ? "user.mfa_replaced" : "user.mfa_enabled", "user", c.u.id, `${c.u.fullName} ${replacing ? "moved two-factor to a new authenticator app" : "set up an authenticator app"}`, c.u.resellerId);
      return { recoveryCodes: recoveryCodes(c.s) };
    }),
  regenerateRecoveryCodes: (code: string) =>
    write((): { recoveryCodes: string[] } => {
      const c = caller();
      if (!c.u.mfaEnrolled) throw new ApiError(409, "NO_APP", "Set up an authenticator app first.");
      sixDigits(code);
      c.u.recoveryCodesLeft = 10;
      audit(c, "user.recovery_codes_regenerated", "user", c.u.id, `${c.u.fullName} made new recovery codes (the old ones stopped working)`, c.u.resellerId);
      return { recoveryCodes: recoveryCodes(c.s) };
    }),
  /** Demo: the browser's passkey prompt is skipped; the backend verifies the WebAuthn response. */
  addPasskey: (name: string) =>
    write((): MySecurity => {
      const c = caller();
      const n = name.trim() || "Passkey";
      if (c.u.passkeys.length >= 10) throw new ApiError(409, "TOO_MANY", "Remove a passkey first (10 at most).");
      c.u.passkeys.push({ id: `pk${++c.s.seq}`, name: n.slice(0, 40), createdAt: nowIso(), lastUsedAt: null });
      audit(c, "user.passkey_added", "user", c.u.id, `${c.u.fullName} added a passkey (${n})`, c.u.resellerId);
      return security(c.u);
    }),
  renamePasskey: (id: string, name: string) =>
    write((): MySecurity => {
      const c = caller();
      const p = c.u.passkeys.find((x) => x.id === id);
      if (!p) throw new ApiError(404, "NOT_FOUND");
      if (!name.trim()) throw new ApiError(400, "NAME_REQUIRED", "Name the passkey, e.g. Work laptop.");
      const before = p.name;
      p.name = name.trim().slice(0, 40);
      audit(c, "user.passkey_renamed", "user", c.u.id, `${c.u.fullName} renamed a passkey`, c.u.resellerId, [{ field: "Passkey", before, after: p.name }]);
      return security(c.u);
    }),
  removePasskey: (id: string) =>
    write((): MySecurity => {
      const c = caller();
      const p = c.u.passkeys.find((x) => x.id === id);
      if (!p) throw new ApiError(404, "NOT_FOUND");
      if (!c.u.mfaEnrolled && c.u.passkeys.length === 1) throw new ApiError(409, "LAST_FACTOR", "Set up an authenticator app before removing your only passkey.");
      c.u.passkeys = c.u.passkeys.filter((x) => x.id !== id);
      audit(c, "user.passkey_removed", "user", c.u.id, `${c.u.fullName} removed a passkey (${p.name})`, c.u.resellerId);
      return security(c.u);
    }),
  /** Ends every session of this account, including this one. */
  signOutEverywhere: () =>
    write(() => {
      const c = caller();
      audit(c, "auth.signed_out_everywhere", "user", c.u.id, `${c.u.fullName} signed out on every device`, c.u.resellerId);
      c.s.session = { userId: null, pendingMfaUserId: null };
    }),
};

export type AccountsApi = typeof demoAccounts;
