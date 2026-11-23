"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Check, Copy, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip } from "@/components/ui/tooltip";
import { useResource } from "@/hooks/use-resource";
import { peopleApi } from "@/lib/api/people";
import { formatPerGb } from "@/lib/platform/money";
import { customPeriod, PERIOD_LABELS, periodFor, type Period, type PeriodPreset } from "@/lib/platform/period";
import type { PriceRange } from "@/lib/platform/types";
import { DATA_UNITS, type DataUnit } from "@/lib/platform/units";
import { cn } from "@/lib/utils";

/** Search box for list toolbars; reports after a short pause while typing. */
export function SearchInput({ value, onChange, placeholder, className, label }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string; label?: string }) {
  const [text, setText] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => text !== value && onChange(text), 200);
    return () => clearTimeout(t);
  }, [text, value, onChange]);
  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-3" strokeWidth={1.5} aria-hidden="true" />
      <Input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={label ?? placeholder} className="pl-9" />
    </div>
  );
}

/** A labelled-by-placeholder select for filters. `all` is the "no filter" choice. */
export function FilterSelect<V extends string>({
  value,
  onChange,
  options,
  all,
  label,
  className,
}: {
  value: V | null;
  onChange: (v: V | null) => void;
  options: { value: V; label: string; disabled?: boolean }[];
  all?: string;
  label: string;
  className?: string;
}) {
  return (
    <Select value={value ?? "__all"} onValueChange={(v) => onChange(v === "__all" ? null : (v as V))}>
      <SelectTrigger className={cn("w-full sm:w-48", className)} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {all ? <SelectItem value="__all">{all}</SelectItem> : null}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Period (spec 8.1): presets plus a custom range. */
export function PeriodSelect({ value, onChange, className }: { value: Period; onChange: (p: Period) => void; className?: string }) {
  const id = useId();
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Select
        value={value.preset}
        onValueChange={(v) => {
          const preset = v as PeriodPreset;
          onChange(preset === "custom" ? customPeriod(value.from, value.to) : periodFor(preset));
        }}
      >
        <SelectTrigger className="w-40" aria-label="Period">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(PERIOD_LABELS) as PeriodPreset[]).map((p) => (
            <SelectItem key={p} value={p}>
              {PERIOD_LABELS[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value.preset === "custom" ? (
        <span className="flex items-center gap-2">
          <Input id={`${id}-from`} type="date" aria-label="From" className="w-40" value={value.from} max={value.to} onChange={(e) => e.target.value && onChange(customPeriod(e.target.value, value.to))} />
          <span className="text-fg-3">to</span>
          <Input id={`${id}-to`} type="date" aria-label="To" className="w-40" value={value.to} min={value.from} onChange={(e) => e.target.value && onChange(customPeriod(value.from, e.target.value))} />
        </span>
      ) : null}
      <Select value={value.granularity} onValueChange={(g) => onChange({ ...value, granularity: g as Period["granularity"] })}>
        <SelectTrigger className="w-32" aria-label="Group by">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="day">By day</SelectItem>
          <SelectItem value="month">By month</SelectItem>
          <SelectItem value="year">By year</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

/** MB / GB / TB for usage charts. */
export function UnitSelect({ value, onChange }: { value: DataUnit; onChange: (u: DataUnit) => void }) {
  return (
    <div role="radiogroup" aria-label="Data unit" className="glass-card inline-flex h-10 items-center gap-0.5 !rounded-full p-1">
      {DATA_UNITS.map((u) => (
        <button
          key={u}
          role="radio"
          aria-checked={value === u}
          onClick={() => onChange(u)}
          className={cn(
            "h-8 rounded-full px-3 text-small font-medium transition-colors duration-[180ms] focus-visible:outline-2 focus-visible:outline-primary",
            value === u ? "bg-surface-3 text-fg shadow-[inset_0_1px_0_var(--highlight),0_0_0_1px_var(--border-strong)]" : "text-fg-2 hover:text-fg",
          )}
        >
          {u}
        </button>
      ))}
    </div>
  );
}

/** Reseller filter for admin and staff ("All resellers" or one). */
export function ResellerSelect({ value, onChange, all = "All resellers", className }: { value: string | null; onChange: (id: string | null) => void; all?: string; className?: string }) {
  const { data } = useResource(() => peopleApi.listResellerOptions(), ["reseller-options"]);
  return <FilterSelect label="Reseller" value={value} onChange={onChange} all={all} className={className} options={(data ?? []).map((r) => ({ value: r.id, label: r.name }))} />;
}

/** Price per GB as a range with the typical (median) price (spec 2.1). */
export function PriceRangeText({ perGb, className }: { perGb: PriceRange | null; className?: string }) {
  if (!perGb) return <span className="text-fg-3">No price</span>;
  const same = Math.abs(perGb.max - perGb.min) < 0.005;
  return (
    <span className={cn("tabular", className)}>
      {same ? (
        formatPerGb(perGb.min / 1024)
      ) : (
        <>
          {formatPerGb(perGb.min / 1024)}–{formatPerGb(perGb.max / 1024)}
          <span className="text-fg-3"> · typically {formatPerGb(perGb.typical / 1024)}</span>
        </>
      )}
    </span>
  );
}

/** Copy to clipboard with a tick for a moment. */
export function CopyButton({ value, label = "Copy", className }: { value: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Tooltip content={done ? "Copied" : label}>
      <button
        type="button"
        aria-label={label}
        onClick={async (e) => {
          e.stopPropagation();
          try {
            await navigator.clipboard.writeText(value);
            setDone(true);
            setTimeout(() => setDone(false), 1400);
          } catch {
            toast.error("Couldn't copy. Select the text and copy it instead.");
          }
        }}
        className={cn("grid size-8 shrink-0 place-items-center rounded-[8px] text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg focus-visible:outline-2 focus-visible:outline-primary", className)}
      >
        {done ? <Check className="size-4 text-accent" strokeWidth={1.75} /> : <Copy className="size-4" strokeWidth={1.5} />}
      </button>
    </Tooltip>
  );
}

/** Small label/value pair for detail panels. */
export function Detail({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <dt className="text-small text-fg-3">{label}</dt>
      <dd className="min-w-0 text-body">{children}</dd>
    </div>
  );
}

/** "Demo zone" chip (demo data only, approved 2026-11-20). */
export function DemoZoneChip() {
  return <span className="inline-flex h-5 items-center rounded-full border border-border px-2 text-[11px] font-medium text-fg-2">Demo zone</span>;
}
