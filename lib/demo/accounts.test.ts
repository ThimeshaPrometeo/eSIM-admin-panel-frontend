import { beforeEach, describe, expect, it } from "vitest";
import { demoAccounts } from "@/lib/api/accounts.demo";
import { demoAuth } from "@/lib/api/auth.demo";
import { STAFF_MATRIX } from "@/lib/platform/permission-matrix";
import { createSeed } from "./seed";
import { __setLatency, __setState, db } from "./store";

beforeEach(() => {
  __setLatency(false);
  __setState(createSeed(new Date()));
  db().session = { userId: "u-admin", pendingMfaUserId: null };
});
const as = (userId: string) => (db().session = { userId, pendingMfaUserId: null });

describe("users", () => {
  it("lists every account with 2FA and lock state", async () => {
    const all = await demoAccounts.listUsers();
    expect(all.length).toBe(db().users.length);
    expect(all.find((u) => u.username === "ishara")!.locked).toBe(true);
    expect((await demoAccounts.listUsers({ state: "no_app" })).map((u) => u.username)).toContain("dilini");
  });

  it("invites a staff user: no password chosen for them; they can't sign in until they accept", async () => {
    const { user, invitation } = await demoAccounts.createStaffUser({ fullName: "Test Person", username: "test.person", email: "t@example.com", staffRoleId: "sr-support" });
    expect(user.invite && !user.invite.expired && !user.mfaApp).toBeTruthy();
    const hours = (Date.parse(invitation.expiresAt) - Date.now()) / 3600000;
    expect(hours).toBeGreaterThan(71.9);
    expect(hours).toBeLessThanOrEqual(72);
    db().session = { userId: null, pendingMfaUserId: null };
    await expect(demoAuth.login({ username: "test.person", password: "anything-long" })).rejects.toMatchObject({ code: "INVITE_PENDING" });
    const token = new URLSearchParams(invitation.demoLink!.split("?")[1]).get("token")!;
    // a resent invitation replaces the old link
    db().session = { userId: "u-admin", pendingMfaUserId: null };
    const again = await demoAccounts.resendInvitation(user.id);
    expect((await demoAuth.checkInvitation(token)).state).toBe("invalid");
    const fresh = new URLSearchParams(again.demoLink!.split("?")[1]).get("token")!;
    db().session = { userId: null, pendingMfaUserId: null };
    const me = await demoAuth.acceptInvitation({ token: fresh, newPassword: "my-own-password" });
    expect(me.username).toBe("test.person");
    expect(me.mfaEnrolled || me.hasPasskey).toBe(false); // 2FA set-up comes next
    db().session = { userId: "u-admin", pendingMfaUserId: null };
    await expect(demoAccounts.createStaffUser({ fullName: "X", username: "test.person", email: "x@example.com", staffRoleId: "sr-support" })).rejects.toMatchObject({ status: 409 });
  });

  it("unlock, reset 2FA (reason required), and admin-only username changes", async () => {
    expect((await demoAccounts.unlockUser("u-ishara")).locked).toBe(false);
    await expect(demoAccounts.resetUserMfa("u-support", "")).rejects.toMatchObject({ status: 400 });
    const r = await demoAccounts.resetUserMfa("u-support", "Lost phone");
    expect(r.mfaApp).toBe(false);
    expect(db().audit[0]!.changes?.[0]?.field).toBe("Two-factor");
    as("u-support");
    await expect(demoAccounts.changeUsername("u-r1", "amaya2")).rejects.toMatchObject({ status: 403 });
    await expect(demoAccounts.setUserStatus("u-admin", "disabled", "")).rejects.toMatchObject({ status: 403 });
    as("u-admin");
    expect((await demoAccounts.changeUsername("u-r1", "amaya.j")).username).toBe("amaya.j");
    await expect(demoAccounts.setUserStatus("u-admin", "disabled", "")).rejects.toMatchObject({ status: 409 });
  });
});

describe("staff roles", () => {
  it("clamps grants to the staff envelope and records what changed", async () => {
    const all = Object.fromEntries(STAFF_MATRIX.flatMap((s) => s.rows.map((r) => [r.module, "manage" as const])));
    const r = await demoAccounts.saveStaffRole(null, { name: "Everything", grants: all });
    expect(r.grants.staff_roles).toBe("view"); // the staff envelope has view only
    expect(r.grants.yesim_connection).toBe("view");
    const support = (await demoAccounts.listStaffRoles()).find((x) => x.name === "Support")!;
    await demoAccounts.saveStaffRole(support.id, { name: "Support", grants: { ...support.grants, inventory: "view" } });
    expect(db().audit[0]!.changes).toEqual([{ field: "Inventory", before: "Off", after: "View" }]);
    expect(db().staffRoles.find((x) => x.id === support.id)!.grants.reseller_plans).toBe("view");
    await expect(demoAccounts.deleteStaffRole(support.id)).rejects.toMatchObject({ status: 409 });
  });
});

describe("audit log", () => {
  it("has a history built from the data, with IPs and before/after", async () => {
    const { rows, options } = await demoAccounts.listAudit();
    expect(rows.length).toBeGreaterThan(150);
    expect(rows.every((r) => r.actorId === null || /^(203\.0\.113|198\.51\.100)\./.test(r.ip ?? ""))).toBe(true);
    expect(rows.some((r) => r.action === "reseller.markup_changed" && r.changes?.[0]?.before === "35%")).toBe(true);
    expect(options.actions).toContain("auth.signed_in");
    // nobody acts before their account existed or after now
    const users = new Map(db().users.map((u) => [u.id, u]));
    expect(rows.filter((r) => r.actorId && r.at < users.get(r.actorId)!.createdAt)).toEqual([]);
    expect(rows.filter((r) => r.at > new Date().toISOString())).toEqual([]);
    // disabled accounts don't sign in after they were disabled
    const ruwan = db().users.find((u) => u.id === "u-ruwan")!;
    const disabledAt = rows.find((r) => r.action === "assistant.disabled")!.at;
    expect(ruwan.lastSignInAt! < disabledAt).toBe(true);
  });
});

describe("my security", () => {
  it("sets up an authenticator with recovery codes shown once", async () => {
    as("u-finance");
    const setup = await demoAccounts.startTotpSetup();
    expect(setup.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(setup.otpauthUri).toContain(setup.secret);
    await expect(demoAccounts.confirmTotp("12")).rejects.toMatchObject({ status: 400 });
    const { recoveryCodes } = await demoAccounts.confirmTotp("123456");
    expect(recoveryCodes).toHaveLength(10);
    expect((await demoAuth.getMe()).mfaEnrolled).toBe(true);
  });

  it("keeps at least one way to confirm sign-in", async () => {
    as("u-finance");
    await demoAccounts.addPasskey("Laptop");
    const me = await demoAccounts.getMySecurity();
    await expect(demoAccounts.removePasskey(me.passkeys[0]!.id)).rejects.toMatchObject({ status: 409 });
  });

  it("forgot and reset password never reveal whether an account exists", async () => {
    db().session = { userId: null, pendingMfaUserId: null };
    expect(await demoAuth.forgotPassword({ identifier: "nobody" })).toEqual({ sent: true, demoLink: null });
    const r = await demoAuth.forgotPassword({ identifier: "ishara" });
    const token = new URLSearchParams(r.demoLink!.split("?")[1]).get("token")!;
    expect((await demoAuth.checkResetToken(token)).valid).toBe(true);
    await demoAuth.resetPassword({ token, newPassword: "a-long-new-password" });
    expect(db().users.find((u) => u.id === "u-ishara")!.locked).toBe(false);
    await expect(demoAuth.resetPassword({ token, newPassword: "a-long-new-password" })).rejects.toMatchObject({ status: 400 });
  });
});
