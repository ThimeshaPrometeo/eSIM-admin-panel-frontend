import { describe, expect, it } from "vitest";
import { autoUnit, formatBytes, fromUnit, toUnit } from "./units";
import { formatMoney, formatPerGb, formatPerMb, formatSignedMoney, money } from "./money";
import { addDays, dateInZone, formatRelative } from "./dates";
import { bucketsIn, customPeriod, periodFor, previousPeriod } from "./period";

describe("units", () => {
  it("uses binary units", () => {
    expect(toUnit(1048576, "MB")).toBe(1);
    expect(fromUnit(1, "GB")).toBe(1073741824);
    expect(autoUnit(500 * 1048576)).toBe("MB");
    expect(formatBytes(1.2 * 1024 ** 3)).toBe("1.2 GB");
    expect(formatBytes(3 * 1024 ** 3)).toBe("3 GB");
    expect(formatBytes(340 * 1048576)).toBe("340 MB");
  });
});

describe("money", () => {
  it("formats EUR", () => {
    expect(formatMoney("1234.5")).toBe("€1,234.50");
    expect(formatMoney(-12)).toBe("−€12.00");
    expect(formatSignedMoney("50")).toBe("+€50.00");
    expect(formatSignedMoney(-3.2)).toBe("−€3.20");
    expect(formatPerMb(0.002584)).toBe("€0.002584");
    expect(formatPerMb(null)).toBe("Unavailable");
    expect(formatPerGb(0.002)).toBe("€2.05");
    expect(money(0.1 + 0.2)).toBe("0.30");
  });
});

describe("dates and periods", () => {
  const now = new Date("2026-11-23T20:30:00Z"); // 24 Nov 02:00 in Colombo
  it("uses the time zone for the calendar date", () => {
    expect(dateInZone(now, "Asia/Colombo")).toBe("2026-11-24");
    expect(dateInZone(now, "UTC")).toBe("2026-11-23");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(formatRelative("2026-11-23T20:25:00Z", now)).toBe("5 min ago");
  });

  it("builds presets, previous periods and buckets", () => {
    const p = periodFor("7d", now);
    expect(p).toMatchObject({ from: "2026-11-18", to: "2026-11-24", granularity: "day" });
    expect(previousPeriod(p)).toMatchObject({ from: "2026-11-11", to: "2026-11-17" });
    expect(periodFor("year", now).granularity).toBe("month");
    expect(bucketsIn({ from: "2026-10-30", to: "2026-11-02", granularity: "month" })).toEqual(["2026-10", "2026-11"]);
    expect(customPeriod("2026-11-10", "2026-01-01").from).toBe("2026-01-01");
  });
});
