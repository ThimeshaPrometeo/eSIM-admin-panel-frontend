"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "../motion/use-reduced-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "../primitives";

/**
 * Shared chart setup (spec 7.5 item 4): token colours, faint grid, glass
 * tooltip with the value first, glow on the main line, draw-in once.
 */
export const SERIES = {
  primary: "var(--primary)",
  accent: "var(--accent)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  neutral: "var(--neutral)",
} as const;

export const AXIS = {
  tick: { fill: "var(--text-3)", fontSize: 12 },
  axisLine: false,
  tickLine: false,
} as const;

export const GRID = { stroke: "var(--grid-line)", vertical: false } as const;

/** Mounts the chart only once it scrolls into view, so it draws in once (spec 7.6). */
export function useDrawOnce() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => {
      if (e.some((x) => x.isIntersecting)) {
        setInView(true);
        io.disconnect();
      }
    }, { rootMargin: "0px 0px -10% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, inView, animate: !reduced, duration: 1100 };
}

export function ChartFrame({
  title,
  description,
  legend,
  action,
  height = 260,
  loading,
  empty,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  legend?: { label: string; color: string; dashed?: boolean }[];
  action?: ReactNode;
  height?: number;
  loading?: boolean;
  empty?: boolean;
  children: (draw: { animate: boolean; duration: number }) => ReactNode;
  className?: string;
}) {
  const { ref, inView, animate, duration } = useDrawOnce();
  return (
    <section className={cn("glass-card flex min-w-0 flex-col p-4 sm:p-6", className)}>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-section font-semibold">{title}</h3>
          {description ? <p className="mt-0.5 text-small text-fg-2">{description}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {legend?.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-2 text-small text-fg-2">
              <span
                className="h-2 w-3 rounded-full"
                style={
                  l.dashed
                    ? { backgroundImage: `repeating-linear-gradient(90deg, ${l.color} 0 3px, transparent 3px 5px)` }
                    : { background: l.color, boxShadow: `0 0 8px ${l.color}` }
                }
              />
              {l.label}
            </span>
          ))}
          {action}
        </div>
      </header>
      <div ref={ref} style={{ height }} className="min-w-0">
        {loading ? (
          <Skeleton className="h-full w-full rounded-control" />
        ) : empty ? (
          <EmptyState illustration="signal" title="No data in this period" description="Try a longer period or another filter." />
        ) : inView ? (
          children({ animate, duration })
        ) : null}
      </div>
    </section>
  );
}

type TooltipEntry = { name?: string | number; value?: number | string; color?: string; payload?: Record<string, unknown>; dataKey?: string | number };

/** Glass tooltip, value first (spec 7.5). */
export function GlassTooltip({
  active,
  payload,
  label,
  format = (v) => String(v),
  labelFormat = (l) => String(l),
}: {
  active?: boolean;
  payload?: readonly TooltipEntry[];
  label?: string | number;
  format?: (v: number, entry: TooltipEntry) => string;
  labelFormat?: (l: string | number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-pop min-w-36 rounded-[12px] px-3.5 py-2.5 text-small">
      {payload.map((p) => (
        <div key={String(p.dataKey ?? p.name)} className="flex items-center justify-between gap-4">
          <span className="text-[15px] font-semibold text-fg tabular">{format(Number(p.value), p)}</span>
          <span className="inline-flex items-center gap-1.5 text-fg-2">
            <span className="size-1.5 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
        </div>
      ))}
      {label !== undefined ? <p className="mt-1 text-fg-3">{labelFormat(label)}</p> : null}
    </div>
  );
}

/** SVG defs: glow filter and area gradients. Ids are unique per chart. */
export function ChartDefs({ id }: { id: string }) {
  return (
    <defs>
      <filter id={`${id}-glow`} x="-20%" y="-50%" width="140%" height="200%">
        <feGaussianBlur stdDeviation="4" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <linearGradient id={`${id}-fill-primary`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="var(--primary)" stopOpacity={0.32} />
        <stop offset="1" stopColor="var(--primary)" stopOpacity={0} />
      </linearGradient>
      <linearGradient id={`${id}-fill-accent`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="var(--accent)" stopOpacity={0.28} />
        <stop offset="1" stopColor="var(--accent)" stopOpacity={0} />
      </linearGradient>
      <linearGradient id={`${id}-signature`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="var(--primary)" />
        <stop offset="1" stopColor="var(--accent)" />
      </linearGradient>
      <linearGradient id={`${id}-bar-primary`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="var(--primary)" stopOpacity={1} />
        <stop offset="1" stopColor="var(--primary)" stopOpacity={0.55} />
      </linearGradient>
      <linearGradient id={`${id}-bar-accent`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="var(--accent)" stopOpacity={1} />
        <stop offset="1" stopColor="var(--accent)" stopOpacity={0.5} />
      </linearGradient>
      <linearGradient id={`${id}-hbar-accent`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="var(--accent)" stopOpacity={0.5} />
        <stop offset="1" stopColor="var(--accent)" stopOpacity={1} />
      </linearGradient>
      <linearGradient id={`${id}-hbar`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="var(--primary)" stopOpacity={0.55} />
        <stop offset="1" stopColor="var(--primary)" stopOpacity={1} />
      </linearGradient>
    </defs>
  );
}
