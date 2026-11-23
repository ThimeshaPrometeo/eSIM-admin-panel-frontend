/**
 * Money (spec 9): EUR, held as decimal strings from the API. Formatting only;
 * the UI never recalculates prices the backend returns. Summaries show 2
 * decimals; per-MB prices 4–6 significant digits.
 */
import type { Money } from "./types";

const eur2 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function toNumber(m: Money | number | null | undefined): number {
  if (m === null || m === undefined) return 0;
  const n = typeof m === "number" ? m : Number(m);
  return Number.isFinite(n) ? n : 0;
}

/** "€1,234.50"; negative as "−€12.00". */
export function formatMoney(m: Money | number | null | undefined): string {
  const n = toNumber(m);
  const s = eur2.format(Math.abs(n));
  return n < 0 && Math.abs(n) >= 0.005 ? `−${s}` : s;
}

/** Signed for ledgers: "+€50.00" / "−€3.20". */
export function formatSignedMoney(m: Money | number): string {
  const n = toNumber(m);
  if (Math.abs(n) < 0.005) return eur2.format(0);
  return `${n > 0 ? "+" : "−"}${eur2.format(Math.abs(n))}`;
}

/** Per-MB price with 4–6 significant digits: "€0.002584". */
export function formatPerMb(n: number | null | undefined): string {
  if (n === null || n === undefined) return "Unavailable";
  const sig = n >= 0.01 ? 4 : n >= 0.001 ? 4 : 3;
  return `€${Number(n.toPrecision(sig)).toLocaleString("en-GB", { maximumFractionDigits: 6, minimumFractionDigits: 2 })}`;
}

/** Per-GB price with 2 decimals: "€2.65". */
export function formatPerGb(perMb: number | null | undefined): string {
  if (perMb === null || perMb === undefined) return "Unavailable";
  return eur2.format(perMb * 1024);
}

/** Decimal string with fixed decimals, for API inputs and the demo store. */
export function money(n: number, decimals = 2): Money {
  const f = 10 ** decimals;
  return (Math.round((n + Number.EPSILON) * f) / f).toFixed(decimals);
}

/** Compact money for chart axes: "€1.2k". */
export function formatMoneyCompact(n: number): string {
  if (Math.abs(n) >= 1000) return `€${(n / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1 })}k`;
  return `€${Math.round(n).toLocaleString("en-GB")}`;
}
