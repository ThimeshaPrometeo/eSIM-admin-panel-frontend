import { describe, expect, it } from "vitest";
import { esimStatus, installStatus, ORDER_STATUS, usageTone } from "./status";

describe("status vocabulary", () => {
  it("names who suspended an eSIM", () => {
    expect(esimStatus("SUSPENDED", "admin").label).toBe("Suspended by admin");
    expect(esimStatus("SUSPENDED", "reseller").label).toBe("Suspended by reseller");
    expect(esimStatus("SUSPENDED", "rule").tone).toBe("danger");
  });
  it("shows an unknown install value as the raw string", () => {
    expect(installStatus("unknown", "Pending-Download-Retry").label).toBe("Pending-Download-Retry");
  });
  it("calls needs_check 'Being verified'", () => {
    expect(ORDER_STATUS.needs_check.label).toBe("Being verified");
  });
  it("switches usage tone at 80% and 100%", () => {
    expect(usageTone(0.79)).toBe("normal");
    expect(usageTone(0.8)).toBe("warning");
    expect(usageTone(0.999)).toBe("warning");
    expect(usageTone(1)).toBe("danger");
  });
});
