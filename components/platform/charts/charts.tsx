"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS, ChartDefs, ChartFrame, GlassTooltip, GRID, SERIES } from "./chart-kit";

/*
 * Every dashboard and usage chart (spec 8.1). Each takes plain data already in
 * the viewer's scope and unit; formatting functions come from the caller.
 */

type Fmt = (n: number) => string;
const plain: Fmt = (n) => n.toLocaleString("en-GB", { maximumFractionDigits: 1 });
const eur: Fmt = (n) => `€${n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
/** Axis ticks stay short so they never clip: 6,000 → 6k. */
const axisNum: Fmt = (n) => (Math.abs(n) >= 1000 ? `${(n / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1 })}k` : plain(n));
const axisEur: Fmt = (n) => `€${axisNum(n)}`;

/**
 * Final and estimated series for a usage chart: the solid line has the final
 * days, the dashed line the estimated days plus their neighbours, so the two
 * join without overlapping (also when a late report leaves one day estimated
 * in the middle of the period).
 */
export function usageSeries(points: { label: string; value: number; estimated: boolean }[]) {
  return points.map((p, i) => ({
    label: p.label,
    final: p.estimated ? null : p.value,
    estimated: p.estimated || points[i - 1]?.estimated || points[i + 1]?.estimated ? p.value : null,
  }));
}
const cssId = (raw: string) => raw.replace(/[^a-zA-Z0-9_-]/g, "");

/** Daily usage, area. The estimated tail (not final yet) is dashed. */
export function UsageAreaChart({
  data,
  unit = "GB",
  title = "Daily data usage",
  description,
}: {
  data: { label: string; final: number | null; estimated: number | null }[];
  unit?: string;
  title?: string;
  description?: string;
}) {
  const id = cssId(useId());
  return (
    <ChartFrame
      title={title}
      description={description}
      legend={[
        { label: "Final", color: SERIES.primary },
        { label: "Estimated", color: SERIES.warning, dashed: true },
      ]}
    >
      {({ animate, duration }) => (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
            <ChartDefs id={id} />
            <CartesianGrid {...GRID} />
            <XAxis dataKey="label" {...AXIS} minTickGap={24} />
            <YAxis {...AXIS} width={48} tickFormatter={axisNum} />
            <Tooltip cursor={{ stroke: "var(--border-strong)" }} content={<GlassTooltip format={(v) => `${plain(v)} ${unit}`} />} />
            <Area
              type="monotone"
              dataKey="final"
              name="Final"
              stroke={SERIES.primary}
              strokeWidth={2}
              fill={`url(#${id}-fill-primary)`}
              filter={`url(#${id}-glow)`}
              isAnimationActive={animate}
              animationDuration={duration}
              animationEasing="ease-out"
              connectNulls={false}
              dot={false}
              activeDot={{ r: 4, fill: "var(--primary)", stroke: "var(--bg)", strokeWidth: 2 }}
            />
            <Area
              type="monotone"
              dataKey="estimated"
              name="Estimated"
              stroke={SERIES.warning}
              strokeWidth={2}
              strokeDasharray="5 4"
              fill="transparent"
              isAnimationActive={animate}
              animationDuration={duration}
              animationBegin={duration * 0.6}
              connectNulls={false}
              dot={false}
              activeDot={{ r: 4, fill: "var(--warning)", stroke: "var(--bg)", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartFrame>
  );
}

/** Monthly usage, bars with rounded ends. */
export function MonthlyBarChart({ data, unit = "GB" }: { data: { label: string; value: number }[]; unit?: string }) {
  const id = cssId(useId());
  return (
    <ChartFrame title="Monthly usage" description={`Data used per month, ${unit}`}>
      {({ animate, duration }) => (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
            <ChartDefs id={id} />
            <CartesianGrid {...GRID} />
            <XAxis dataKey="label" {...AXIS} />
            <YAxis {...AXIS} width={48} tickFormatter={axisNum} />
            <Tooltip cursor={{ fill: "var(--surface-3)", opacity: 0.4 }} content={<GlassTooltip format={(v) => `${plain(v)} ${unit}`} />} />
            <Bar dataKey="value" name="Usage" fill={`url(#${id}-bar-primary)`} radius={[8, 8, 3, 3]} maxBarSize={36} isAnimationActive={animate} animationDuration={duration} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartFrame>
  );
}

/** eSIM status donut. */
/**
 * eSIM status donut. The centre shows `total` (e.g. sold eSIMs) when given,
 * so a stock slice doesn't change the headline count.
 */
export function StatusDonut({
  data,
  total: shownTotal,
  totalLabel = "eSIMs",
}: {
  data: { label: string; value: number; tone: keyof typeof SERIES }[];
  total?: number;
  totalLabel?: string;
}) {
  const total = shownTotal ?? data.reduce((s, d) => s + d.value, 0);
  return (
    <ChartFrame title="eSIM status" legend={data.map((d) => ({ label: d.label, color: SERIES[d.tone] }))}>
      {({ animate, duration }) => (
        <div className="relative h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={<GlassTooltip format={(v) => `${plain(v)} eSIMs`} />} />
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius="68%"
                outerRadius="92%"
                paddingAngle={2.5}
                cornerRadius={6}
                stroke="none"
                isAnimationActive={animate}
                animationDuration={duration}
              >
                {data.map((d) => (
                  <Cell key={d.label} fill={SERIES[d.tone]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="text-[28px] font-semibold leading-8 tabular">{plain(total)}</p>
              <p className="text-small text-fg-2">{totalLabel}</p>
            </div>
          </div>
        </div>
      )}
    </ChartFrame>
  );
}

/** Plan types sold. */
export function PlansSoldChart({ data }: { data: { label: string; value: number }[] }) {
  const id = cssId(useId());
  return (
    <ChartFrame title="Plans sold" description="Count per plan">
      {({ animate, duration }) => (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 4, bottom: 0 }}>
            <ChartDefs id={id} />
            <CartesianGrid stroke="var(--grid-line)" horizontal={false} />
            <XAxis type="number" {...AXIS} allowDecimals={false} />
            <YAxis type="category" dataKey="label" {...AXIS} width={92} interval={0} />
            <Tooltip cursor={{ fill: "var(--surface-3)", opacity: 0.4 }} content={<GlassTooltip format={(v) => `${plain(v)} sold`} />} />
            <Bar dataKey="value" name="Sold" fill={`url(#${id}-hbar-accent)`} radius={[3, 8, 8, 3]} maxBarSize={16} isAnimationActive={animate} animationDuration={duration} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartFrame>
  );
}

/**
 * Transactions over time: credits (Emerald bars, left scale) vs debits
 * (Azure line, right scale). Top-ups are large and occasional, usage charges
 * small and daily; one scale would hide the debits.
 */
export function TransactionsChart({ data }: { data: { label: string; credits: number; debits: number }[] }) {
  const id = cssId(useId());
  return (
    <ChartFrame
      title="Transactions"
      description="Credits (left) vs debits (right), EUR"
      legend={[
        { label: "Credits", color: SERIES.accent },
        { label: "Debits", color: SERIES.primary },
      ]}
    >
      {({ animate, duration }) => (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 0, left: -4, bottom: 0 }}>
            <ChartDefs id={id} />
            <CartesianGrid {...GRID} />
            <XAxis dataKey="label" {...AXIS} minTickGap={16} />
            <YAxis yAxisId="credits" {...AXIS} width={52} tickFormatter={axisEur} />
            <YAxis yAxisId="debits" orientation="right" {...AXIS} width={48} tickFormatter={axisEur} />
            <Tooltip cursor={{ fill: "var(--surface-3)", opacity: 0.4 }} content={<GlassTooltip format={eur} />} />
            <Bar yAxisId="credits" dataKey="credits" name="Credits" fill={`url(#${id}-bar-accent)`} radius={[6, 6, 2, 2]} maxBarSize={18} isAnimationActive={animate} animationDuration={duration} />
            <Line
              yAxisId="debits"
              type="monotone"
              dataKey="debits"
              name="Debits"
              stroke={SERIES.primary}
              strokeWidth={2}
              dot={false}
              filter={`url(#${id}-glow)`}
              isAnimationActive={animate}
              animationDuration={duration}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </ChartFrame>
  );
}

/** Top 10 eSIMs by usage, horizontal; a click opens the eSIM. */
export function TopEsimsBar({
  data,
  unit = "GB",
  onSelect,
}: {
  data: { id: string; label: string; value: number }[];
  unit?: string;
  onSelect?: (id: string) => void;
}) {
  const id = cssId(useId());
  return (
    <ChartFrame title="Top 10 eSIMs by usage" description="Click a bar to open the eSIM" height={320}>
      {({ animate, duration }) => (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
            <ChartDefs id={id} />
            <CartesianGrid stroke="var(--grid-line)" horizontal={false} />
            <XAxis type="number" {...AXIS} tickFormatter={axisNum} />
            <YAxis
              type="category"
              dataKey="label"
              {...AXIS}
              width={92}
              tick={{ ...AXIS.tick, fontFamily: "var(--font-mono)", fontSize: 11 }}
            />
            <Tooltip cursor={{ fill: "var(--surface-3)", opacity: 0.4 }} content={<GlassTooltip format={(v) => `${plain(v)} ${unit}`} />} />
            <Bar
              dataKey="value"
              name="Usage"
              fill={`url(#${id}-hbar)`}
              radius={[3, 8, 8, 3]}
              maxBarSize={16}
              className="cursor-pointer"
              onClick={(d: { payload?: { id?: string } }) => d.payload?.id && onSelect?.(d.payload.id)}
              isAnimationActive={animate}
              animationDuration={duration}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartFrame>
  );
}

/** Usage by country. */
export function CountryBar({ data, unit = "GB" }: { data: { label: string; value: number }[]; unit?: string }) {
  const id = cssId(useId());
  return (
    <ChartFrame title="Usage by country" description={`Top countries, ${unit}`}>
      {({ animate, duration }) => (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
            <ChartDefs id={id} />
            <CartesianGrid {...GRID} />
            <XAxis dataKey="label" {...AXIS} interval={0} angle={-35} textAnchor="end" height={52} tick={{ ...AXIS.tick, fontSize: 11 }} />
            <YAxis {...AXIS} width={48} tickFormatter={axisNum} />
            <Tooltip cursor={{ fill: "var(--surface-3)", opacity: 0.4 }} content={<GlassTooltip format={(v) => `${plain(v)} ${unit}`} />} />
            <Bar dataKey="value" name="Usage" fill={`url(#${id}-bar-primary)`} radius={[8, 8, 3, 3]} maxBarSize={28} isAnimationActive={animate} animationDuration={duration} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartFrame>
  );
}

/** Revenue (bars) and profit (glowing signature line). Needs profit_reports. */
export function RevenueProfitChart({ data }: { data: { label: string; revenue: number; cost: number; profit: number }[] }) {
  const id = cssId(useId());
  return (
    <ChartFrame
      title="Revenue and profit"
      description="Reseller charges and direct sales vs supplier cost, EUR"
      legend={[
        { label: "Revenue", color: SERIES.primary },
        { label: "Supplier cost", color: SERIES.neutral },
        { label: "Profit", color: SERIES.accent },
      ]}
    >
      {({ animate, duration }) => (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 4, left: -4, bottom: 0 }} barGap={3}>
            <ChartDefs id={id} />
            <CartesianGrid {...GRID} />
            <XAxis dataKey="label" {...AXIS} />
            <YAxis {...AXIS} width={56} tickFormatter={axisEur} />
            <Tooltip cursor={{ fill: "var(--surface-3)", opacity: 0.4 }} content={<GlassTooltip format={eur} />} />
            <Bar dataKey="revenue" name="Revenue" fill={`url(#${id}-bar-primary)`} radius={[6, 6, 2, 2]} maxBarSize={20} isAnimationActive={animate} animationDuration={duration} />
            <Bar dataKey="cost" name="Supplier cost" fill="var(--neutral)" fillOpacity={0.45} radius={[6, 6, 2, 2]} maxBarSize={20} isAnimationActive={animate} animationDuration={duration} />
            <Line
              type="monotone"
              dataKey="profit"
              name="Profit"
              stroke={`url(#${id}-signature)`}
              strokeWidth={2.5}
              filter={`url(#${id}-glow)`}
              dot={false}
              activeDot={{ r: 4, fill: "var(--accent)", stroke: "var(--bg)", strokeWidth: 2 }}
              isAnimationActive={animate}
              animationDuration={duration}
              animationBegin={duration * 0.4}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </ChartFrame>
  );
}

/**
 * Waterfall (spec 8.32): Yesim cost, + markup, − discounts, = revenue, and
 * profit. Floating bars: each step starts where the previous one ended.
 */
export function WaterfallChart({ data, title = "From Yesim cost to profit", description }: { data: { cost: number; markup: number; discount: number; revenue: number; profit: number }; title?: string; description?: string }) {
  const id = cssId(useId());
  // each bar is a range [from, to]: steps float where the previous one ended
  const top = data.cost + data.markup;
  const steps = [
    { label: "Yesim cost", range: [0, data.cost], value: data.cost, fill: SERIES.neutral },
    { label: "+ Markup", range: [data.cost, top], value: data.markup, fill: SERIES.primary },
    { label: "− Discounts", range: [top - data.discount, top], value: -data.discount, fill: SERIES.warning },
    { label: "= Revenue", range: [0, data.revenue], value: data.revenue, fill: SERIES.primary },
    { label: "Profit", range: [0, data.profit], value: data.profit, fill: SERIES.accent },
  ];
  return (
    <ChartFrame title={title} description={description ?? "EUR in the period; revenue = Yesim cost + markup − discounts"}>
      {({ animate, duration }) => (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={steps} margin={{ top: 22, right: 4, left: -4, bottom: 0 }}>
            <ChartDefs id={id} />
            <CartesianGrid {...GRID} />
            <XAxis dataKey="label" {...AXIS} interval={0} />
            <YAxis {...AXIS} width={56} tickFormatter={axisEur} domain={[0, "auto"]} />
            <Tooltip
              cursor={{ fill: "var(--surface-3)", opacity: 0.4 }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <div className="glass-pop rounded-[10px] px-3 py-2 text-small">
                    <p className="text-fg-2">{(payload[0]!.payload as { label: string }).label}</p>
                    <p className="font-semibold tabular">{eur((payload[0]!.payload as { value: number }).value)}</p>
                  </div>
                ) : null
              }
            />
            <Bar
              dataKey="range"
              name="Amount"
              radius={[6, 6, 2, 2]}
              maxBarSize={56}
              isAnimationActive={animate}
              animationDuration={duration}
              label={({ x, y, width, index }: { x?: number | string; y?: number | string; width?: number | string; index?: number }) => (
                <text x={Number(x ?? 0) + Number(width ?? 0) / 2} y={Number(y ?? 0) - 6} textAnchor="middle" fill="var(--text-2)" fontSize={11}>
                  {eur(Math.abs(steps[index ?? 0]!.value))}
                </text>
              )}
            >
              {steps.map((s) => (
                <Cell key={s.label} fill={s.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartFrame>
  );
}
