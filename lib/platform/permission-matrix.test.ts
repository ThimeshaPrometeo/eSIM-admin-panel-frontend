import { describe, expect, it } from "vitest";
import {
  canToggle,
  clampToEnvelope,
  enabledCount,
  RESELLER_ENVELOPE,
  RESELLER_MATRIX,
  sectionState,
  setAction,
  setManage,
  setSection,
  setView,
  type Grants,
  type MatrixRow,
} from "./permission-matrix";

const row = (module: string): MatrixRow => RESELLER_MATRIX.flatMap((s) => s.rows).find((r) => r.module === module)!;
const section = (id: string) => RESELLER_MATRIX.find((s) => s.id === id)!;
const env = RESELLER_ENVELOPE;

describe("permission matrix rules", () => {
  it("manage on turns view on", () => {
    expect(setManage({}, row("esims"), env, true).esims).toBe("manage");
  });

  it("view off turns manage off", () => {
    expect(setView({ esims: "manage" }, row("esims"), env, false).esims).toBe("none");
  });

  it("manage off keeps view", () => {
    expect(setManage({ customers: "manage" }, row("customers"), env, false).customers).toBe("view");
  });

  it("view on keeps an existing manage", () => {
    expect(setView({ customers: "manage" }, row("customers"), env, true).customers).toBe("manage");
  });

  it("view-only rows have no manage switch", () => {
    expect(canToggle(row("dashboard"), env, "manage")).toBe(false);
    expect(setManage({}, row("dashboard"), env, true).dashboard).toBeUndefined();
  });

  it("action-only rows (Sell eSIM) are one switch stored as manage", () => {
    expect(setAction({}, row("sell_esim"), env, true).sell_esim).toBe("manage");
    expect(setAction({ sell_esim: "manage" }, row("sell_esim"), env, false).sell_esim).toBe("none");
  });

  it("never exceeds the envelope", () => {
    const limited: Grants = { ...env, customers: "view", invoices: "none" };
    expect(canToggle(row("customers"), limited, "manage")).toBe(false);
    expect(setManage({}, row("customers"), limited, true).customers).toBeUndefined();
    expect(canToggle(row("invoices"), limited, "view")).toBe(false);
    expect(setView({}, row("invoices"), limited, true).invoices).toBeUndefined();
  });

  it("a section switch turns every row on to its maximum, or off", () => {
    const on = setSection({}, section("sales"), env, true);
    expect(on).toMatchObject({ sell_esim: "manage", reseller_plans: "manage", coverage: "view", price_lists: "view" });
    expect(sectionState(on, section("sales"), env)).toBe("on");
    const off = setSection(on, section("sales"), env, false);
    expect(sectionState(off, section("sales"), env)).toBe("off");
  });

  it("a section with only some rows on is mixed", () => {
    expect(sectionState({ coverage: "view" }, section("sales"), env)).toBe("mixed");
  });

  it("section on respects the envelope", () => {
    const limited: Grants = { ...env, reseller_plans: "view" };
    expect(setSection({}, section("sales"), limited, true).reseller_plans).toBe("view");
    expect(sectionState({ sell_esim: "manage", reseller_plans: "view", coverage: "view", price_lists: "view" }, section("sales"), limited)).toBe("on");
  });

  it("clamps stored grants that are above a shrunk envelope", () => {
    const clamped = clampToEnvelope({ esims: "manage", customers: "manage" }, RESELLER_MATRIX, { ...env, esims: "view" });
    expect(clamped.esims).toBe("view");
    expect(clamped.customers).toBe("manage");
  });

  it("counts enabled areas", () => {
    expect(enabledCount({ dashboard: "view", esims: "manage" }, RESELLER_MATRIX)).toEqual({ enabled: 2, total: 13 });
  });

  it("has no Team management or Orders toggle for assistants", () => {
    const modules = RESELLER_MATRIX.flatMap((s) => s.rows.map((r) => r.module));
    expect(modules).not.toContain("team");
    expect(modules).not.toContain("orders");
  });
});
