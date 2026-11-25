"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";
import { Popover } from "radix-ui";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, ChevronRight, Info, OctagonAlert, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { countryFlag } from "@/lib/platform/coverage";
import { DEFAULT_TIME_ZONE } from "@/lib/platform/dates";
import { customPeriod, periodFor, type Period, type PeriodPreset } from "@/lib/platform/period";
import type { AttentionItem, OverviewOptions, RunwayLevel, Trend } from "@/lib/platform/types";
import { cn } from "@/lib/utils";
import { FilterSelect, ResellerSelect } from "./fields";

/*
 * Pieces of the dashboard (spec 8.1, redesign 2026-11). Plain components: the
 * page decides scope and layout (dashboard-client.tsx).
 */

// ------------------------------------------------------------------ format

const GB = 1024 ** 3;
export const eur0 = (n: number) => `€${Math.round(n).toLocaleString("en-GB")}`;
export const eur2 = (n: number) => `€${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const gb = (bytes: number) => {
  const v = bytes / GB;
  return v >= 1000 ? `${(v / 1024).toLocaleString("en-GB", { maximumFractionDigits: 2 })} TB` : `${v.toLocaleString("en-GB", { maximumFractionDigits: v < 10 ? 2 : v < 100 ? 1 : 0 })} GB`;
};
export const pct = (n: number) => `${n.toLocaleString("en-GB", { maximumFractionDigits: 1 })}%`;
const delta = (t: Trend) => (t.previous !== null && t.previous !== 0 ? (t.value - t.previous) / Math.abs(t.previous) : null);

// ------------------------------------------------------------------ shells

/** A dashboard panel: title, optional control, and a body that fills the rest. */
export function Panel({ title, action, children, className, bodyClassName }: { title: string; action?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("glass-card flex min-h-0 min-w-0 flex-col overflow-hidden p-3.5 pb-3", className)}>
      <header className="mb-2 flex min-w-0 items-center justify-between gap-2">
        <h2 id={id} className="truncate text-body font-semibold">
          {title}
        </h2>
        {action}
      </header>
      <div className={cn("flex min-h-0 flex-1 flex-col", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Small segmented switch. */
export function Seg<V extends string>({ value, onChange, options, label }: { value: V; onChange: (v: V) => void; options: readonly (readonly [V, string])[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex h-7 shrink-0 items-center gap-0.5 rounded-full border border-border p-0.5">
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "h-6 whitespace-nowrap rounded-full px-1.5 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary",
            value === v ? "bg-surface-3 text-fg" : "text-fg-2 hover:text-fg",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

// -------------------------------------------------------------- filter bar

export type OverviewFilters = { period: Period; compare: boolean; resellerId: string | null; iso2: string | null; networkId: string | null; planId: string | null };

export const DEFAULT_PRESET: Exclude<PeriodPreset, "custom" | "year"> = "30d";
export const defaultFilters = (): OverviewFilters => ({ period: periodFor(DEFAULT_PRESET), compare: true, resellerId: null, iso2: null, networkId: null, planId: null });

const PRESETS: [Exclude<PeriodPreset, "year">, string][] = [
  ["today", "Today"],
  ["7d", "7 days"],
  ["30d", "30 days"],
  ["month", "This month"],
  ["last_month", "Last month"],
  ["custom", "Custom"],
];

/** Period presets, compare toggle and filters; everything applies at once. */
export function OverviewFilterBar({
  value,
  onChange,
  options,
  tenant,
}: {
  value: OverviewFilters;
  onChange: (f: OverviewFilters) => void;
  options: OverviewOptions | null;
  /** Admin and staff also filter by reseller. */
  tenant: boolean;
}) {
  const id = useId();
  const set = (patch: Partial<OverviewFilters>) => onChange({ ...value, ...patch });
  const p = value.period;
  const active = [value.resellerId, value.iso2, value.networkId, value.planId].filter(Boolean).length;
  const dirty = active > 0 || p.preset !== DEFAULT_PRESET || !value.compare;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2" role="group" aria-label="Dashboard filters">
      <div role="radiogroup" aria-label="Period" className="inline-flex h-8 max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-border bg-surface-1/60 p-0.5 [scrollbar-width:none]">
        {PRESETS.map(([k, l]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={p.preset === k}
            onClick={() => set({ period: k === "custom" ? customPeriod(p.from, p.to) : periodFor(k) })}
            className={cn(
              "h-7 whitespace-nowrap rounded-full px-2.5 text-small font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary",
              p.preset === k ? "bg-surface-3 text-fg" : "text-fg-2 hover:text-fg",
            )}
          >
            {l}
          </button>
        ))}
      </div>
      {p.preset === "custom" ? (
        <span className="flex items-center gap-1.5">
          <Input type="date" aria-label="From" className="h-8 w-[136px]" value={p.from} max={p.to} onChange={(e) => e.target.value && set({ period: customPeriod(e.target.value, p.to) })} />
          <span className="text-small text-fg-3">to</span>
          <Input type="date" aria-label="To" className="h-8 w-[136px]" value={p.to} min={p.from} onChange={(e) => e.target.value && set({ period: customPeriod(p.from, e.target.value) })} />
        </span>
      ) : null}
      <span className="text-small text-fg-3" title="Days run midnight to midnight in this time zone">
        {DEFAULT_TIME_ZONE}
      </span>
      <label htmlFor={`${id}-cmp`} className="flex items-center gap-2 text-small text-fg-2">
        <Switch id={`${id}-cmp`} checked={value.compare} onCheckedChange={(compare) => set({ compare })} />
        Compare with previous period
      </label>
      <div className="ml-auto flex items-center gap-2">
        <Popover.Root>
          <Popover.Trigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-small font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                active ? "border-primary/60 text-fg" : "border-border text-fg-2 hover:text-fg",
              )}
            >
              <SlidersHorizontal className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              Filters
              {active ? <span className="rounded-full bg-primary-solid px-1.5 text-[11px] leading-[18px] text-on-solid tabular">{active}</span> : null}
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content align="end" sideOffset={8} className="glass-pop z-50 flex w-[300px] flex-col gap-3 rounded-card p-4 outline-none [&_button[role=combobox]]:h-9 [&_button[role=combobox]]:w-full">
              <p className="text-small font-semibold text-fg">Narrow the dashboard</p>
              {tenant ? (
                <FilterRow label="Reseller">
                  <ResellerSelect value={value.resellerId} onChange={(resellerId) => set({ resellerId })} className="sm:w-full" />
                </FilterRow>
              ) : null}
              <FilterRow label="Country">
                <FilterSelect label="Country" value={value.iso2} onChange={(iso2) => set({ iso2 })} all="All countries" options={(options?.countries ?? []).map((c) => ({ value: c.iso2, label: c.name }))} className="sm:w-full" />
              </FilterRow>
              <FilterRow label="Network">
                <FilterSelect label="Network" value={value.networkId} onChange={(networkId) => set({ networkId })} all="All networks" options={(options?.networks ?? []).map((n) => ({ value: n.id, label: n.label }))} className="sm:w-full" />
              </FilterRow>
              <FilterRow label="Plan">
                <FilterSelect label="Plan" value={value.planId} onChange={(planId) => set({ planId })} all="All plans" options={(options?.plans ?? []).map((x) => ({ value: x.id, label: x.name }))} className="sm:w-full" />
              </FilterRow>
              <Popover.Arrow className="fill-[var(--glass-strong)]" />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        {dirty ? (
          <button type="button" onClick={() => onChange(defaultFilters())} className="rounded px-1 text-small font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary">
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-fg-3">{label}</span>
      {children}
    </div>
  );
}

// -------------------------------------------------------------------- KPIs

function DeltaBadge({ t, goodWhenUp = true }: { t: Trend; goodWhenUp?: boolean }) {
  const d = delta(t);
  if (d === null) return null;
  const up = d >= 0;
  const good = up === goodWhenUp;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 whitespace-nowrap text-[11px] font-medium tabular", Math.abs(d) < 0.005 ? "text-fg-3" : good ? "text-accent" : "text-warning")} title="Compared with the previous period">
      <Icon aria-hidden="true" className="size-3.5" strokeWidth={2} />
      <span className="sr-only">{up ? "up" : "down"} </span>
      {Math.abs(d * 100).toFixed(Math.abs(d) < 0.1 ? 1 : 0)}%
    </span>
  );
}

const LEVEL_TEXT: Record<RunwayLevel, string> = { ok: "text-fg-3", warning: "text-warning", critical: "text-danger" };
const LEVEL_DOT: Record<RunwayLevel, string> = { ok: "bg-accent", warning: "bg-warning", critical: "bg-danger" };
const LEVEL_WORD: Record<RunwayLevel, string> = { ok: "", warning: "Low: ", critical: "Critical: " };

/**
 * A slim KPI: label and trend on one line, the value below with an optional
 * short note beside it (margin, days left). Detail goes in `title` (hover).
 * With `level` the tile shows a status dot and colours the note.
 */
export function KpiTile({
  label,
  value,
  trend,
  goodWhenUp,
  note,
  level,
  href,
  title,
  loading,
  className,
}: {
  label: string;
  value: string;
  trend?: Trend;
  goodWhenUp?: boolean;
  note?: string;
  level?: RunwayLevel;
  href?: string;
  title?: string;
  loading?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <span className="flex min-w-0 items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 truncate text-small text-fg-2">
          {level ? <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", LEVEL_DOT[level])} /> : null}
          {label}
        </span>
        {trend && !loading ? <DeltaBadge t={trend} goodWhenUp={goodWhenUp} /> : null}
      </span>
      {loading ? (
        <Skeleton className="h-6 w-20" />
      ) : (
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate text-[20px] font-semibold leading-6 tracking-[-0.02em] tabular">{value}</span>
          {note ? (
            <span className={cn("shrink-0 truncate text-[11px]", level ? LEVEL_TEXT[level] : "text-fg-3")}>
              {level ? <span className="sr-only">{LEVEL_WORD[level]}</span> : null}
              {note}
            </span>
          ) : null}
        </span>
      )}
    </>
  );
  const cls = cn(
    "glass-card flex min-w-0 flex-col justify-center gap-1 px-3 py-2",
    level === "warning" && "bg-[color-mix(in_oklch,var(--warning)_7%,var(--glass))]",
    level === "critical" && "bg-[color-mix(in_oklch,var(--danger)_9%,var(--glass))]",
    className,
  );
  return href ? (
    <Link href={href} title={title} className={cn(cls, "glass-card-interactive focus-visible:outline-2 focus-visible:outline-primary")}>
      {body}
    </Link>
  ) : (
    <div className={cls} title={title}>
      {body}
    </div>
  );
}

// ---------------------------------------------------------- needs attention

const TONE_ICON = { info: Info, warning: AlertTriangle, danger: OctagonAlert } as const;
const TONE_CLASS = { info: "text-primary", warning: "text-warning", danger: "text-danger" } as const;

/** The list of things to act on; "All clear" when empty. */
export function AttentionList({ items }: { items: AttentionItem[] }) {
  if (items.length === 0)
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1.5 text-center">
        <CheckCircle2 aria-hidden="true" className="size-6 text-accent" strokeWidth={1.5} />
        <p className="text-body font-medium">All clear</p>
        <p className="text-small text-fg-3">Nothing is waiting for you.</p>
      </div>
    );
  return (
    <ul className="-mx-1.5 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
      {items.map((a) => {
        const Icon = TONE_ICON[a.tone];
        return (
          <li key={a.key}>
            <Link href={a.href} className="group flex items-center gap-2.5 rounded-control px-1.5 py-1.5 transition-colors hover:bg-surface-3/50 focus-visible:outline-2 focus-visible:outline-primary">
              <Icon aria-hidden="true" className={cn("size-4 shrink-0", TONE_CLASS[a.tone])} strokeWidth={1.75} />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 block text-small font-medium leading-4 text-fg">{a.label}</span>
                {a.detail ? <span className="block truncate text-[11px] text-fg-3">{a.detail}</span> : null}
              </span>
              <span className={cn("rounded-full bg-surface-3 px-2 py-0.5 text-small font-semibold tabular", TONE_CLASS[a.tone])}>{a.count}</span>
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-fg-3 transition-transform group-hover:translate-x-0.5" strokeWidth={1.75} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------- countries

/** A ranked row: a country (flag from `iso2`) or anything else (`flag: null`, e.g. a network). */
export type CountryRow = { iso2: string; name: string; value: number; display: string; detail?: string; flag?: string | null };

/**
 * Ranked items with inline bars. On the dashboard: the top countries
 * (selecting one focuses the dashboard on it), or, with a country in focus,
 * the networks used there (selecting one narrows to that network).
 */
export function TopCountriesCard<M extends string>({
  title = "Top countries",
  selectLabel = "Focus the dashboard on this country",
  metric,
  onMetric,
  metrics,
  rows,
  selected,
  onSelect,
  onOpen,
  loading,
  className,
}: {
  metric: M;
  onMetric: (m: M) => void;
  metrics: readonly (readonly [M, string])[];
  /** Sorted by the chosen metric. */
  rows: CountryRow[];
  selected: string | null;
  onSelect: (iso2: string | null) => void;
  /** Open Usage for a country. */
  onOpen: (iso2: string) => void;
  title?: string;
  selectLabel?: string;
  loading?: boolean;
  className?: string;
}) {
  const top = rows.slice(0, 6);
  const max = Math.max(0, ...top.map((r) => r.value));
  const total = rows.reduce((a, r) => a + r.value, 0);
  return (
    <Panel title={title} className={className} action={metrics.length > 1 ? <Seg value={metric} onChange={onMetric} options={metrics} label="Rank countries by" /> : undefined}>
      {loading ? (
        <Skeleton className="h-full" />
      ) : top.length === 0 ? (
        <p className="m-auto text-small text-fg-3">No usage in this period</p>
      ) : (
        <ol className={cn("flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto", top.length >= 5 ? "justify-between" : "justify-start gap-2")}>
          {top.map((r) => {
            const on = selected === r.iso2;
            return (
              <li key={r.iso2} className={cn("group rounded-control px-1.5 py-1 transition-colors", on ? "bg-surface-3/70" : "hover:bg-surface-3/40")}>
                <div className="flex min-w-0 items-center gap-2 text-[12px]">
                  <button
                    type="button"
                    onClick={() => onSelect(on ? null : r.iso2)}
                    aria-pressed={on}
                    className="flex min-w-0 flex-1 items-center gap-1.5 rounded text-left text-fg focus-visible:outline-2 focus-visible:outline-primary"
                    title={selectLabel}
                  >
                    {r.flag === null ? null : <span aria-hidden="true">{r.flag ?? countryFlag(r.iso2)}</span>}
                    <span className="truncate">{r.name}</span>
                  </button>
                  <span className="shrink-0 font-medium tabular text-fg">{r.display}</span>
                  <span className="w-8 shrink-0 text-right text-[11px] text-fg-3 tabular">{total > 0 ? `${Math.round((r.value / total) * 100)}%` : ""}</span>
                  <button
                    type="button"
                    onClick={() => onOpen(r.iso2)}
                    aria-label={`Open usage for ${r.name}`}
                    className="grid size-5 shrink-0 place-items-center rounded text-fg-3 opacity-60 transition-opacity hover:text-fg group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <ChevronRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
                  </button>
                </div>
                <div className="ml-[22px] mr-[60px] mt-0.5 h-1 overflow-hidden rounded-full bg-surface-3/60" aria-hidden="true">
                  <div className="h-full rounded-full bg-[var(--series-1)]" style={{ width: `${max > 0 ? Math.max(2, (r.value / max) * 100) : 0}%` }} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

// ------------------------------------------------------------------- tables

export type Col<T> = { key: string; header: string; cell: (row: T) => ReactNode; align?: "left" | "right"; className?: string };

/** A compact table that scrolls inside its card, header pinned. */
export function MiniTable<T>({ rows, cols, rowKey, empty, caption }: { rows: T[]; cols: Col<T>[]; rowKey: (r: T) => string; empty: string; caption: string }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full table-fixed text-[12px] tabular">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 z-[1] bg-[var(--glass-strong)] backdrop-blur-sm">
          <tr className="text-[11px] text-fg-3">
            {cols.map((c) => (
              <th key={c.key} scope="col" className={cn("pb-1 font-medium", c.align === "left" ? "text-left" : "text-right", c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className="border-t border-border/60">
              {cols.map((c, i) =>
                i === 0 ? (
                  <th key={c.key} scope="row" className={cn("truncate py-[5px] text-left font-normal text-fg", c.className)}>
                    {c.cell(r)}
                  </th>
                ) : (
                  <td key={c.key} className={cn("truncate py-[5px] text-fg-2", c.align === "left" ? "text-left" : "text-right", c.className)}>
                    {c.cell(r)}
                  </td>
                ),
              )}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={cols.length} className="py-4 text-center text-fg-3">
                {empty}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export function TrendText({ value }: { value: number | null }) {
  if (value === null) return <span className="text-fg-3">–</span>;
  const up = value >= 0;
  return (
    <span className={cn("inline-flex items-center justify-end gap-0.5", Math.abs(value) < 0.005 ? "text-fg-3" : up ? "text-accent" : "text-warning")}>
      {up ? <ArrowUpRight aria-hidden="true" className="size-3" strokeWidth={2} /> : <ArrowDownRight aria-hidden="true" className="size-3" strokeWidth={2} />}
      <span className="sr-only">{up ? "up" : "down"} </span>
      {Math.abs(value * 100).toFixed(0)}%
    </span>
  );
}

/** One card with tabs (Needs attention | Plans | Resellers); a tab can carry a count badge. */
export function TabbedCard<K extends string>({
  tabs,
  value,
  onChange,
  children,
  className,
}: {
  tabs: readonly { key: K; label: string; badge?: number; tone?: "warning" | "info" }[];
  value: K;
  onChange: (k: K) => void;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section className={cn("glass-card flex min-h-0 min-w-0 flex-col overflow-hidden p-3.5 pb-3", className)} aria-label={tabs.find((t) => t.key === value)?.label}>
      <div role="tablist" aria-label="Details" className="mb-2 flex items-center gap-4 overflow-x-auto border-b border-border [scrollbar-width:none]">
        {tabs.map((t) => (
          <button
            key={t.key}
            id={`${id}-${t.key}`}
            type="button"
            role="tab"
            aria-selected={value === t.key}
            aria-controls={`${id}-panel`}
            onClick={() => onChange(t.key)}
            className={cn(
              "-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 pb-1.5 text-body font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary",
              value === t.key ? "border-primary text-fg" : "border-transparent text-fg-3 hover:text-fg-2",
            )}
          >
            {t.label}
            {t.badge ? <span className={cn("rounded-full px-1.5 text-[11px] leading-[17px] tabular", t.tone === "warning" ? "bg-warning/20 text-warning" : "bg-surface-3 text-fg-2")}>{t.badge}</span> : null}
          </button>
        ))}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${value}`} className="flex min-h-0 flex-1 flex-col">
        {children}
      </div>
    </section>
  );
}
