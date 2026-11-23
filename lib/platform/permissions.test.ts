import { describe, expect, it } from "vitest";
import { can, effectivePermissions, ROLE_ENVELOPES, rules } from "./permissions";
import { routeAccess, visibleNav } from "./nav-config";
import type { Grants } from "./permission-matrix";
import type { Me } from "./types";

const reseller = effectivePermissions({ role: "reseller" });
const admin = effectivePermissions({ role: "admin" });
const me = (role: Me["role"], permissions = effectivePermissions(role === "staff" ? { role, grants: {} } : role === "assistant" ? { role, grants: {}, reseller } : { role })) => ({ role, permissions });

describe("effective permissions", () => {
  it("admin and reseller get their whole envelope", () => {
    expect(admin).toEqual(ROLE_ENVELOPES.admin);
    expect(reseller).toEqual(ROLE_ENVELOPES.reseller);
    expect(can(reseller, "resellers")).toBe(false);
    expect(can(reseller, "team", "manage")).toBe(true);
  });

  it("staff = envelope ∩ grants (grants above the envelope are capped)", () => {
    const p = effectivePermissions({ role: "staff", grants: { esims: "manage", profit_reports: "manage", settings: "manage" } });
    expect(p.esims).toBe("manage");
    expect(p.profit_reports).toBe("view"); // staff envelope caps at view
    expect(p.settings).toBe("view");
    expect(p.wallets).toBe("none"); // not granted
  });

  it("assistant never exceeds the reseller and never gets team", () => {
    const grants: Grants = { esims: "manage", team: "manage", wallets: "manage", plans: "manage" };
    const limited = { ...reseller, esims: "view" as const };
    const p = effectivePermissions({ role: "assistant", grants, reseller: limited });
    expect(p.esims).toBe("view");
    expect(p.team).toBe("none");
    expect(p.wallets).toBe("view");
    expect(p.plans).toBe("none");
  });

  it("assistant orders follow sell eSIM or transactions", () => {
    expect(effectivePermissions({ role: "assistant", grants: { sell_esim: "manage" }, reseller }).orders).toBe("view");
    expect(effectivePermissions({ role: "assistant", grants: { transactions: "view" }, reseller }).orders).toBe("view");
    expect(effectivePermissions({ role: "assistant", grants: { dashboard: "view" }, reseller }).orders).toBe("none");
  });

  it("tenant envelope limits everyone", () => {
    const tenant = { ...ROLE_ENVELOPES.admin, discounts: "none" as const };
    expect(effectivePermissions({ role: "admin", tenant }).discounts).toBe("none");
  });
});

describe("role rules", () => {
  it("markup: admin edits, staff reads, resellers never see it", () => {
    const staff = me("staff", effectivePermissions({ role: "staff", grants: { resellers: "manage" } }));
    expect(rules.canChangeMarkup(me("admin"))).toBe(true);
    expect(rules.canChangeMarkup(staff)).toBe(false);
    expect(rules.canSeeMarkup(staff)).toBe(true);
    expect(rules.canSeeMarkup(me("reseller"))).toBe(false);
  });

  it("resellers lift only their own suspensions", () => {
    expect(rules.canReactivate(me("reseller"), "reseller")).toBe(true);
    expect(rules.canReactivate(me("reseller"), "admin")).toBe(false);
    expect(rules.canReactivate(me("admin"), "rule")).toBe(true);
  });

  it("admin-only actions", () => {
    const staff = me("staff", effectivePermissions({ role: "staff", grants: { plans: "manage", discounts: "manage", wallets: "manage", esims: "manage" } }));
    for (const r of [rules.canEditPlans, rules.canEditDiscounts, rules.canAdjustWallet, rules.canSetEndOfLife, rules.canResolveOrder]) {
      expect(r(me("admin"))).toBe(true);
      expect(r(staff)).toBe(false);
    }
    expect(rules.canManagePlansOnEsim(staff)).toBe(true);
    expect(rules.canManagePlansOnEsim(me("reseller"))).toBe(false);
  });

  it("top-ups: tenant approves, reseller side requests", () => {
    expect(rules.canApproveTopups(me("admin"))).toBe(true);
    expect(rules.canApproveTopups(me("reseller"))).toBe(false);
    expect(rules.canRequestTopup(me("reseller"))).toBe(true);
    expect(rules.canRequestTopup(me("admin"))).toBe(false);
  });
});

describe("navigation and route guard", () => {
  it("hides tabs without view and empty sections", () => {
    const p = effectivePermissions({ role: "assistant", grants: { dashboard: "view", sell_esim: "manage", coverage: "view" }, reseller });
    const nav = visibleNav("assistant", p);
    expect(nav.map((s) => s.id)).toEqual(["overview", "sales", "esims", "settings"]);
    expect(nav.find((s) => s.id === "sales")!.tabs.map((t) => t.id)).toEqual(["sell", "coverage"]);
    expect(nav.find((s) => s.id === "esims")!.tabs.map((t) => t.id)).toEqual(["orders"]);
    expect(nav.some((s) => s.id === "team")).toBe(false);
  });

  it("reseller sees team, admin sees system", () => {
    expect(visibleNav("reseller", reseller).some((s) => s.id === "team")).toBe(true);
    expect(visibleNav("admin", admin).some((s) => s.id === "system")).toBe(true);
  });

  it("decides direct URL access", () => {
    expect(routeAccess("admin", admin, "/esim/esims/42").kind).toBe("ok");
    expect(routeAccess("admin", admin, "/esim/inventory").kind).toBe("ok");
    expect(routeAccess("admin", admin, "/esim/audit-log").kind).toBe("coming_soon");
    expect(routeAccess("reseller", reseller, "/esim/inventory").kind).toBe("denied");
    expect(routeAccess("reseller", reseller, "/esim/alerts").kind).toBe("ok");
    expect(routeAccess("reseller", reseller, "/esim/resellers").kind).toBe("denied");
    expect(routeAccess("reseller", reseller, "/esim/wallets/w1").kind).toBe("denied"); // other role family
    expect(routeAccess("admin", admin, "/esim/wallet").kind).toBe("denied");
    const assistant = effectivePermissions({ role: "assistant", grants: { dashboard: "view" }, reseller });
    expect(routeAccess("assistant", assistant, "/esim/wallet").kind).toBe("denied");
    expect(routeAccess("assistant", assistant, "/esim/assistants").kind).toBe("denied");
    expect(routeAccess("admin", admin, "/esim/nowhere").kind).toBe("unknown");
    expect(routeAccess("admin", admin, "/notifications").kind).toBe("unknown"); // everyone's page, not denied
    expect(routeAccess("staff", effectivePermissions({ role: "staff", grants: {} }), "/profile").kind).toBe("unknown");
  });
});
