/** Data amounts (spec 9): bytes in, binary units out. 1 MB = 1,048,576 bytes. */
export type DataUnit = "MB" | "GB" | "TB";
export const DATA_UNITS: DataUnit[] = ["MB", "GB", "TB"];
export const BYTES: Record<DataUnit, number> = { MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };

export function toUnit(bytes: number, unit: DataUnit): number {
  return bytes / BYTES[unit];
}

export function fromUnit(value: number, unit: DataUnit): number {
  return Math.round(value * BYTES[unit]);
}

/** The largest unit where the value is at least 1 (MB at minimum). */
export function autoUnit(bytes: number): DataUnit {
  if (Math.abs(bytes) >= BYTES.TB) return "TB";
  if (Math.abs(bytes) >= BYTES.GB) return "GB";
  return "MB";
}

/** "1.2 GB", "340 MB", "0 MB". Whole numbers drop the decimals. */
export function formatBytes(bytes: number, unit: DataUnit | "auto" = "auto", decimals?: number): string {
  const u = unit === "auto" ? autoUnit(bytes) : unit;
  const v = toUnit(bytes, u);
  const d = decimals ?? (Number.isInteger(v) ? 0 : Math.abs(v) >= 100 ? 0 : 1);
  return `${v.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d })} ${u}`;
}

/** A plan size: "1 GB", "500 MB". */
export function formatPlanData(bytes: number): string {
  return formatBytes(bytes, "auto");
}
