import { ApiError } from "./errors";
import { meFor } from "@/lib/demo/derive";
import { read, write } from "@/lib/demo/run";
import { caller, nowIso } from "@/lib/demo/session";
import { db, resetDemoData } from "@/lib/demo/store";
import type { Me, Role } from "@/lib/platform/types";

export type LoginResult = { mfaRequired: true; methods: ("totp" | "recovery")[] } | { mfaRequired: false; me: Me };

/** The demo user behind each role in the role switcher (demo-data.md §3). */
export const DEMO_ROLE_USERS: Record<Role, string> = { admin: "u-admin", staff: "u-support", reseller: "u-r1", assistant: "u-sahan" };

function finish(userId: string): Me {
  const s = db();
  const u = s.users.find((x) => x.id === userId)!;
  u.lastSignInAt = nowIso();
  s.session = { userId: u.id, pendingMfaUserId: null };
  return meFor(s, u);
}

export const demoAuth = {
  /** Demo sign-in accepts any password; a known username or email signs in as that user, anything else as the admin. */
  login: (input: { username: string; password: string }) =>
    write((): LoginResult => {
      const s = db();
      const key = input.username.trim().toLowerCase();
      const u = s.users.find((x) => x.username === key || x.email.toLowerCase() === key) ?? s.users.find((x) => x.id === "u-admin")!;
      if (!input.password) throw new ApiError(401, "INVALID_CREDENTIALS");
      if (u.status !== "active") throw new ApiError(401, "ACCOUNT_DISABLED");
      if (u.locked) throw new ApiError(401, "ACCOUNT_LOCKED");
      if (u.mfaEnrolled) {
        s.session = { userId: null, pendingMfaUserId: u.id };
        return { mfaRequired: true, methods: ["totp", "recovery"] };
      }
      return { mfaRequired: false, me: finish(u.id) };
    }),
  /** Any 6 digits, or a recovery code of at least 8 characters. */
  verifyMfa: (input: { code: string; method: "totp" | "recovery" }) =>
    write(() => {
      const s = db();
      if (!s.session.pendingMfaUserId) throw new ApiError(401, "UNAUTHENTICATED");
      const ok = input.method === "totp" ? /^\d{6}$/.test(input.code) : input.code.replace(/\W/g, "").length >= 8;
      if (!ok) throw new ApiError(401, "INVALID_CODE");
      return finish(s.session.pendingMfaUserId);
    }),
  hasPendingMfa: () => read(() => !!db().session.pendingMfaUserId),
  /** Demo passkey: replaces password and 2FA (D59) and signs in as the admin. */
  passkeyLogin: () => write(() => finish(DEMO_ROLE_USERS.admin)),
  getMe: () => read(() => caller().me),
  logout: () =>
    write(() => {
      db().session = { userId: null, pendingMfaUserId: null };
    }),
  changePassword: (input: { currentPassword: string; newPassword: string }) =>
    write(() => {
      const c = caller();
      if (input.newPassword.length < 10) throw new ApiError(400, "PASSWORD_TOO_SHORT");
      c.u.mustChangePassword = false;
      return meFor(c.s, c.u);
    }),
  switchDemoRole: (role: Role) => write(() => finish(DEMO_ROLE_USERS[role])),
  resetDemo: async () => {
    resetDemoData();
  },
};
