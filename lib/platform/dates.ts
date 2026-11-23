/**
 * Dates (spec 9): stored in UTC, shown in the user's time zone (tenant
 * default Asia/Colombo), with relative times where helpful.
 */
export const DEFAULT_TIME_ZONE = "Asia/Colombo";

const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string, opts: Intl.DateTimeFormatOptions) {
  const key = tz + JSON.stringify(opts);
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, ...opts });
    cache.set(key, f);
  }
  return f;
}

/** "23 Nov 2026" */
export function formatDate(iso: string | null | undefined, tz = DEFAULT_TIME_ZONE): string {
  if (!iso) return "—";
  return fmt(tz, { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

/** "23 Nov 2026, 14:05" */
export function formatDateTime(iso: string | null | undefined, tz = DEFAULT_TIME_ZONE): string {
  if (!iso) return "—";
  return fmt(tz, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

/** Axis labels: "23 Nov" (day), "Nov 26" (month), "2026" (year). */
export function formatAxisDate(isoDate: string, granularity: "day" | "month" | "year" = "day", tz = "UTC"): string {
  const d = new Date(isoDate.length === 10 ? `${isoDate}T00:00:00Z` : isoDate);
  if (granularity === "year") return fmt(tz, { year: "numeric" }).format(d);
  if (granularity === "month") return fmt(tz, { month: "short", year: "2-digit" }).format(d);
  return fmt(tz, { day: "numeric", month: "short" }).format(d);
}

/** "just now", "5 min ago", "3 h ago", "2 days ago", then the date. Future: "in 3 days". */
export function formatRelative(iso: string | null | undefined, now: Date = new Date(), tz = DEFAULT_TIME_ZONE): string {
  if (!iso) return "—";
  const diff = (now.getTime() - new Date(iso).getTime()) / 1000;
  const future = diff < 0;
  const s = Math.abs(diff);
  const say = (v: number, unit: string) => (future ? `in ${v} ${unit}` : `${v} ${unit} ago`);
  if (s < 60) return future ? "in a moment" : "just now";
  if (s < 3600) return say(Math.round(s / 60), "min");
  if (s < 86400) return say(Math.round(s / 3600), "h");
  if (s < 86400 * 14) {
    const d = Math.round(s / 86400);
    return say(d, d === 1 ? "day" : "days");
  }
  return formatDate(iso, tz);
}

/** The calendar date (YYYY-MM-DD) of an instant in a time zone. */
export function dateInZone(d: Date, tz = DEFAULT_TIME_ZONE): string {
  const parts = fmt(tz, { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Add days to a YYYY-MM-DD date. */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from a to b (YYYY-MM-DD). */
export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000);
}
