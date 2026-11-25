"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Popover } from "radix-ui";
import { Info } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
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
  "The last two days (and any day whose report from Yesim is late) are estimated. We price the data our usage meter saw, at that day's price, the same way as final days. When Yesim's nightly report confirms the megabytes per network, the day is re-priced and becomes final; any small difference shows as an adjustment in the wallet.";

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
}) {
  // bars grow in once; later updates (a background refresh, a filter) change in place
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), 1400);
    return () => clearTimeout(t);
  }, []);
  const anyEstimated = data.some((d) => d.estimated);
  const stacked = segments.length > 1;
  // the parts' legend sits under the chart, keeping the header for the title and its one-line insight
  return (
    <ChartFrame
      title={title}
      description={insight}
      action={anyEstimated ? <EstimateInfo /> : undefined}
      legend={stacked ? segments.map((s) => ({ label: s.label, color: s.color })) : undefined}
      empty={data.every((d) => !d.total)}
    >
      {({ animate, duration }) => (
        <ChartBox>
          <BarChart
            data={data}
            syncId={syncId}
            margin={{ top: 10, right: 6, left: -4, bottom: 0 }}
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
            <YAxis {...AXIS} width={56} tickFormatter={axisFormat} tickCount={4} />
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

/** The daily average and the best day of a series, for a chart's subtitle and average line. */
export function trendInsight(rows: TrendRow[], format: (v: number) => string, per: "day" | "month" | "year" = "day"): { text: string; average: number | null } {
  const days = rows.filter((r) => r.total > 0);
  if (!days.length) return { text: "", average: null };
  const average = days.reduce((a, r) => a + r.total, 0) / days.length;
  const best = days.reduce((a, r) => (r.total > a.total ? r : a));
  return { text: `avg ${format(average)}/${per} · best ${best.label} ${format(best.total)}`, average };
}
