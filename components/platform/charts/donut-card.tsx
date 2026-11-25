"use client";

import { memo, useState, type ReactNode } from "react";
import { Cell, Pie, PieChart, Tooltip } from "recharts";
import { cn } from "@/lib/utils";
import { ChartBox } from "./chart-box";

/*
 * A donut with its legend (dashboard plan mix): a few items plus "Other";
 * colours follow the entity (`colorOf`, fixed per item so a switch of measure
 * doesn't repaint it), the total sits in the middle, and the legend
 * carries every label, value and share, so colour is never the only cue.
 * Hovering a legend row or a slice highlights it.
 */

export type DonutSlice = {
  key: string;
  label: string;
  sub?: string;
  value: number;
};

/** Categorical series tokens (validated, styles/globals.css); "Other" is neutral. */
export const SERIES_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
] as const;
export const OTHER_COLOR = "var(--series-other)";

/** Fixed colours by entity: the first keys get the series in order; the rest fold into Other. */
export function colorMap(keys: string[]) {
  const m = new Map<string, string>();
  keys
    .slice(0, SERIES_COLORS.length)
    .forEach((k, i) => m.set(k, SERIES_COLORS[i]!));
  return m;
}

/** Memoised: a background refresh with the same figures doesn't redraw it. */
export const DonutCard = memo(function DonutCard({
  title,
  slices,
  colorOf,
  format,
  totalLabel,
  action,
  empty = "No usage in this period",
  className,
}: {
  title: string;
  /** Already cut to top + Other. */
  slices: DonutSlice[];
  colorOf: (key: string) => string;
  format: (v: number) => string;
  totalLabel: string;
  /** In the header, right (a measure switch). */
  action?: ReactNode;
  empty?: string;
  className?: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const total = slices.reduce((a, s) => a + s.value, 0);
  const color = (k: string) => (k === "other" ? OTHER_COLOR : colorOf(k));
  return (
    <section
      className={cn(
        "glass-card flex min-h-0 min-w-0 flex-col overflow-hidden p-3.5 pb-3",
        className,
      )}
      aria-label={title}
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <h2 className="min-w-0 truncate text-body font-semibold">{title}</h2>
        {action}
      </header>
      {total <= 0 ? (
        <p className="m-auto text-small text-fg-3">{empty}</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          {/* the donut takes the height the legend leaves, square and centred */}
          <div className="flex min-h-[96px] flex-1 items-center justify-center">
            <div className="relative aspect-square h-full max-h-[190px]">
              <ChartBox>
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="value"
                    nameKey="label"
                    innerRadius="66%"
                    outerRadius="100%"
                    paddingAngle={1.2}
                    stroke="var(--bg)"
                    strokeWidth={1}
                    startAngle={90}
                    endAngle={-270}
                    isAnimationActive={false}
                    onMouseEnter={(_, i) => setActive(slices[i]?.key ?? null)}
                    onMouseLeave={() => setActive(null)}
                  >
                    {slices.map((s) => (
                      <Cell
                        key={s.key}
                        fill={color(s.key)}
                        fillOpacity={active && active !== s.key ? 0.3 : 1}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active: on, payload }) => {
                      const p = on
                        ? (payload?.[0]?.payload as DonutSlice | undefined)
                        : undefined;
                      if (!p) return null;
                      return (
                        <div className="glass-pop rounded-[10px] px-2.5 py-1.5 text-small">
                          <span className="font-semibold text-fg tabular">
                            {format(p.value)}
                          </span>
                          <span className="ml-2 text-fg-2">
                            {p.label} · {Math.round((p.value / total) * 100)}%
                          </span>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ChartBox>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[15px] font-semibold leading-5 text-fg tabular">
                  {format(total)}
                </span>
                <span className="text-[10px] text-fg-3">{totalLabel}</span>
              </div>
            </div>
          </div>
          <ul
            className="grid shrink-0 grid-cols-2 gap-x-3 gap-y-[3px]"
            aria-label={`${title}: share by item`}
          >
            {slices.map((s) => (
              <li
                key={s.key}
                onMouseEnter={() => setActive(s.key)}
                onMouseLeave={() => setActive(null)}
                className={cn(
                  "flex min-w-0 items-center gap-1.5 text-[11px] leading-[15px] transition-opacity",
                  active && active !== s.key && "opacity-50",
                )}
              >
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-[3px]"
                  style={{ background: color(s.key) }}
                />
                <span
                  className="min-w-0 flex-1 truncate text-fg"
                  title={`${s.label}${s.sub ? ` (${s.sub})` : ""}`}
                >
                  {s.label}
                  {s.sub ? (
                    <span className="ml-1 text-fg-3">{s.sub}</span>
                  ) : null}
                </span>
                <span className="shrink-0 tabular text-fg-2">
                  {Math.round((s.value / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
});
