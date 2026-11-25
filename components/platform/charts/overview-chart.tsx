"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Popover } from "radix-ui";
import { Info } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceDot, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { ChartBox } from "./chart-box";
import { AXIS, ChartFrame, GRID } from "./chart-kit";

/*
 * The dashboard's trend charts (spec 8.1). One axis, plain bars:
 *  - a single measure (data used, spend), or
 *  - two stacked segments that add up to a whole (Yesim cost + profit = revenue),
 *    so the composition reads without switching.
 * A dashed line marks the period's daily average; the subtitle gives the
 * average and the best day, so the chart answers "is this normal?" at a
 * glance. Charts with the same `syncId` hover together: pointing at a day in
 * one shows the same day in the other. Days still estimated are faded.
 * Click a bar to open that day.
 */

export type TrendRow = { bucket: string; label: string; estimated: boolean; total: number; [segment: string]: number | string | boolean };
export type TrendSegment = { key: string; label: string; color: string };
export type TipRow = { label: string; value: string; color?: string; strong?: boolean };

/** The dashboard's day charts hover together. */
export const OVERVIEW_SYNC_ID = "overview-days";

/** What "estimated" means, in plain words (shown from the chart's info button). */
export const ESTIMATE_EXPLAINED =
  "Today's figures are estimated at the highest network price in each zone and are corrected overnight with exact per-network prices.";

function EstimateInfo() {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-1.5 text-[11px] text-fg-3 transition-colors hover:bg-surface-3/60 hover:text-fg focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span aria-hidden="true" className="h-2 w-2.5 rounded-[2px] bg-current opacity-40" />
          Estimated
          <Info className="size-3" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="bottom" align="end" sideOffset={6} className="glass-pop z-50 max-w-[320px] rounded-[12px] px-3.5 py-3 text-small leading-[1.5] text-fg-2 outline-none">
          <p className="mb-1 font-semibold text-fg">What&apos;s estimated?</p>
          {ESTIMATE_EXPLAINED}
          <Popover.Arrow className="fill-[var(--glass-strong)]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function TrendChart({
  title,
  insight,
  data,
  segments,
  axisFormat,
  tooltipRows,
  average,
  syncId,
  onSelect,
  selectHint = "Click to open this day",
  switcher,
  overflowFormat,
}: {
  title: string;
  /** One line under the title: the average and the best day. */
  insight?: ReactNode;
  data: TrendRow[];
  /** Bottom to top. One segment = plain bars; two = stacked (they add up to `total`). */
  segments: TrendSegment[];
  axisFormat: (v: number) => string;
  /** The tooltip's rows for a day. */
  tooltipRows: (row: TrendRow) => TipRow[];
  /** Daily average of `total`: a dashed reference line. */
  average?: number | null;
  syncId?: string;
  onSelect?: (bucket: string) => void;
  selectHint?: string;
  /** A measure switch in the header (Revenue | Data). */
  switcher?: { value: string; onChange: (v: string) => void; options: readonly (readonly [string, string])[] };
  /** Short format for the marker on an estimated bar taller than the scale ("€2.4k"). */
  overflowFormat?: (v: number) => string;
}) {
  // bars grow in once; later updates (a background refresh, a filter) change in place
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), 1400);
    return () => clearTimeout(t);
  }, []);
  const anyEstimated = data.some((d) => d.estimated);
  const stacked = segments.length > 1;
  // estimated days are priced provisionally (zone's highest price) and can tower over the rest:
  // the scale follows the final days and taller estimated bars are clipped with their value on top
  const finalMax = Math.max(0, ...data.filter((d) => !d.estimated).map((d) => d.total));
  const cap = finalMax > 0 && data.some((d) => d.estimated && d.total > finalMax * 1.3) ? finalMax * 1.3 : null;
  // the parts' legend sits under the chart, keeping the header for the title and its one-line insight
  return (
    <ChartFrame
      title={title}
      description={insight}
      action={
        anyEstimated || switcher ? (
          <div className="flex items-center gap-2">
            {anyEstimated ? <EstimateInfo /> : null}
            {switcher ? (
              <div role="radiogroup" aria-label="Measure" className="inline-flex h-7 shrink-0 items-center gap-0.5 rounded-full border border-border p-0.5">
                {switcher.options.map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={switcher.value === v}
                    onClick={() => switcher.onChange(v)}
                    className={cn(
                      "h-6 whitespace-nowrap rounded-full px-2.5 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                      switcher.value === v ? "bg-surface-3 text-fg" : "text-fg-2 hover:text-fg",
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : undefined
      }
      legend={stacked ? segments.map((s) => ({ label: s.label, color: s.color })) : undefined}
      empty={data.every((d) => !d.total)}
    >
      {({ animate, duration }) => (
        <ChartBox>
          <BarChart
            data={data}
            syncId={syncId}
            margin={{ top: cap ? 18 : 10, right: cap ? 16 : 6, left: -4, bottom: 0 }}
            barCategoryGap="22%"
            onClick={(e) => {
              const i = Number(e?.activeTooltipIndex);
              const b = Number.isFinite(i) ? data[i]?.bucket : undefined;
              if (b && onSelect) onSelect(b);
            }}
            style={{ cursor: onSelect ? "pointer" : undefined }}
          >
            <CartesianGrid {...GRID} />
            <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={18} />
            <YAxis {...AXIS} width={56} tickFormatter={axisFormat} tickCount={4} domain={cap ? [0, cap] : [0, "auto"]} allowDataOverflow={!!cap} />
            <Tooltip
              cursor={{ fill: "var(--surface-3)", opacity: 0.4 }}
              content={({ active, payload }) => {
                const p = active ? (payload?.[0]?.payload as TrendRow | undefined) : undefined;
                if (!p) return null;
                return (
                  <div className="glass-pop min-w-44 max-w-[260px] rounded-[12px] px-3.5 py-2.5 text-small">
                    <p className="mb-1 font-medium text-fg">{p.label}</p>
                    {tooltipRows(p).map((r) => (
                      <div key={r.label} className="flex items-center justify-between gap-4 py-px">
                        <span className="inline-flex items-center gap-1.5 text-fg-2">
                          {r.color ? <span aria-hidden="true" className="h-2 w-2.5 rounded-[2px]" style={{ background: r.color }} /> : <span className="w-2.5" />}
                          {r.label}
                        </span>
                        <span className={r.strong ? "font-semibold text-fg tabular" : "text-fg tabular"}>{r.value}</span>
                      </div>
                    ))}
                    {p.estimated ? <p className="mt-1.5 text-[11px] text-warning">Estimated: final after Yesim&apos;s nightly report</p> : null}
                    {onSelect ? <p className="mt-1 text-[11px] text-fg-3">{selectHint}</p> : null}
                  </div>
                );
              }}
            />
            {average ? (
              <ReferenceLine
                y={average}
                stroke="var(--text-3)"
                strokeDasharray="4 4"
                strokeOpacity={0.9}
                ifOverflow="extendDomain"
                label={{ value: "avg", position: "insideTopRight", fill: "var(--text-3)", fontSize: 10 }}
              />
            ) : null}
            {/* clipped estimated bars: their value at the top of the scale (independent of the bars' grow-in) */}
            {cap
              ? overflowMarks(data, cap).map((d) => (
                    <ReferenceDot
                      key={`over-${d.bucket}`}
                      x={d.label}
                      y={cap}
                      r={0}
                      ifOverflow="visible"
                      label={{ value: `↑${(overflowFormat ?? axisFormat)(d.total)}`, position: "top", offset: 4, fill: "var(--warning)", fontSize: 9.5 }}
                    />
                  ))
              : null}
            {segments.map((s, i) => {
              const top = i === segments.length - 1;
              return (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  stackId={stacked ? "s" : undefined}
                  radius={top ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  maxBarSize={24}
                  isAnimationActive={animate && !drawn}
                  animationDuration={duration}
                >
                  {data.map((d) => (
                    <Cell
                      key={d.bucket}
                      fill={s.color}
                      fillOpacity={d.estimated ? 0.38 : 1}
                      // a thin surface gap between the stacked parts
                      stroke={stacked && !top ? "var(--bg)" : undefined}
                      strokeWidth={stacked && !top ? 1 : 0}
                    />
                  ))}
                </Bar>
              );
            })}
          </BarChart>
        </ChartBox>
      )}
    </ChartFrame>
  );
}

/**
 * The clipped estimated bars that get a value marker: the tallest first, skipping any
 * too close to one already marked (neighbouring labels would overlap; the tooltip has every value).
 */
function overflowMarks(data: TrendRow[], cap: number): TrendRow[] {
  const gap = Math.max(1, Math.ceil(data.length / 10));
  const kept: number[] = [];
  data
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => d.estimated && d.total > cap)
    .sort((a, b) => b.d.total - a.d.total)
    .forEach(({ i }) => {
      if (kept.every((k) => Math.abs(k - i) >= gap)) kept.push(i);
    });
  return kept.sort((a, b) => a - b).map((i) => data[i]!);
}

/** The daily average and the best day of a series, for a chart's subtitle and average line. */
export function trendInsight(rows: TrendRow[], format: (v: number) => string, per: "day" | "month" | "year" = "day"): { text: string; average: number | null } {
  // final days only: estimated days are priced provisionally until the nightly report
  const days = rows.filter((r) => r.total > 0 && !r.estimated);
  if (!days.length) return { text: "", average: null };
  const average = days.reduce((a, r) => a + r.total, 0) / days.length;
  const best = days.reduce((a, r) => (r.total > a.total ? r : a));
  return { text: `avg ${format(average)}/${per} · best ${best.label} ${format(best.total)}`, average };
}
