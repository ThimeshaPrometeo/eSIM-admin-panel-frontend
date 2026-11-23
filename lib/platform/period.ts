/**
 * Periods for reports (spec 8.1): today, 7 days, 30 days, this month, this
 * year, custom; grouped by day, month or year. Dates are calendar dates
 * (YYYY-MM-DD) in the user's time zone, inclusive.
 */
import { addDays, dateInZone, daysBetween, DEFAULT_TIME_ZONE } from "./dates";

export type PeriodPreset = "today" | "7d" | "30d" | "month" | "year" | "custom";
export type Granularity = "day" | "month" | "year";
export type Period = { preset: PeriodPreset; from: string; to: string; granularity: Granularity };

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  month: "This month",
  year: "This year",
  custom: "Custom range",
};

export function periodFor(preset: Exclude<PeriodPreset, "custom">, now: Date = new Date(), tz = DEFAULT_TIME_ZONE): Period {
  const today = dateInZone(now, tz);
  switch (preset) {
    case "today":
      return { preset, from: today, to: today, granularity: "day" };
    case "7d":
      return { preset, from: addDays(today, -6), to: today, granularity: "day" };
    case "30d":
      return { preset, from: addDays(today, -29), to: today, granularity: "day" };
    case "month":
      return { preset, from: `${today.slice(0, 8)}01`, to: today, granularity: "day" };
    case "year":
      return { preset, from: `${today.slice(0, 5)}01-01`, to: today, granularity: "month" };
  }
}

export function customPeriod(from: string, to: string): Period {
  const [a, b] = from <= to ? [from, to] : [to, from];
  const days = daysBetween(a, b) + 1;
  return { preset: "custom", from: a, to: b, granularity: days > 400 ? "year" : days > 62 ? "month" : "day" };
}

/** The period of the same length just before (for "vs previous period" deltas). */
export function previousPeriod(p: Period): Period {
  const len = daysBetween(p.from, p.to) + 1;
  return { ...p, preset: "custom", from: addDays(p.from, -len), to: addDays(p.from, -1) };
}

/** Bucket key of a date for a granularity: "2026-11-23", "2026-11", "2026". */
export function bucketOf(date: string, g: Granularity): string {
  return g === "day" ? date : g === "month" ? date.slice(0, 7) : date.slice(0, 4);
}

/** Every bucket from `from` to `to`, in order. */
export function bucketsIn(p: Pick<Period, "from" | "to" | "granularity">): string[] {
  const out: string[] = [];
  let d = p.from;
  while (d <= p.to) {
    const b = bucketOf(d, p.granularity);
    if (out[out.length - 1] !== b) out.push(b);
    d = addDays(d, 1);
  }
  return out;
}
