"use client";

import * as React from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountUp } from "./motion/count-up";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Page header (structure from the SIP panel: actions stack under the title on
 * phones). No eyebrow text, sentence case (spec 7.3).
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-title font-semibold">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-body text-fg-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** A key number, large, with a small quiet label (spec 7.3). */
export function StatBlock({
  label,
  value,
  format,
  delta,
  hint,
  size = "lg",
  loading,
}: {
  label: string;
  value: number;
  format?: (n: number) => string;
  /** Change vs the previous period, as a fraction (0.12 = +12%). */
  delta?: number;
  hint?: string;
  size?: "sm" | "lg" | "display";
  loading?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-small text-fg-2">{label}</span>
      {loading ? (
        <Skeleton className={size === "display" ? "h-11 w-32" : "h-9 w-24"} />
      ) : (
        <CountUp
          value={value}
          format={format}
          className={cn(
            "whitespace-nowrap font-semibold tracking-[-0.02em]",
            size === "display" ? "text-[32px] leading-9 sm:text-display" : size === "sm" ? "text-[22px] leading-7" : "text-[24px] leading-8 sm:text-[30px] sm:leading-9",
          )}
        />
      )}
      {delta !== undefined || hint ? (
        <span className="flex items-center gap-2 text-small text-fg-3">
          {delta !== undefined ? (
            <span className={cn("inline-flex items-center gap-1 font-medium tabular", delta >= 0 ? "text-accent" : "text-danger")}>
              {delta >= 0 ? <TrendingUp className="size-3.5" strokeWidth={1.5} /> : <TrendingDown className="size-3.5" strokeWidth={1.5} />}
              {delta >= 0 ? "+" : "−"}
              {Math.abs(delta * 100).toFixed(1)}%
            </span>
          ) : null}
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/** Empty state: a small glowing line illustration and one clear action (spec 7.8). */
export function EmptyState({
  illustration = "sim",
  title,
  description,
  action,
}: {
  illustration?: "sim" | "globe" | "signal";
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <LineIllustration kind={illustration} />
      <p className="mt-5 text-section font-semibold">{title}</p>
      <p className="mt-1.5 max-w-sm text-body text-fg-2">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function LineIllustration({ kind, className }: { kind: "sim" | "globe" | "signal"; className?: string }) {
  const id = React.useId();
  return (
    <svg viewBox="0 0 96 96" className={cn("size-24", className)} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="48" cy="48" r="40" fill="var(--primary-glow)" opacity="0.18" />
      <g stroke={`url(#${id}-g)`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${id}-glow)`}>
        {kind === "sim" ? (
          <>
            <path d="M32 20h24l12 12v42a2 2 0 0 1-2 2H32a2 2 0 0 1-2-2V22a2 2 0 0 1 2-2Z" />
            <rect x="38" y="44" width="20" height="18" rx="3" />
            <path d="M38 50h20M38 56h20M45 44v18M51 44v18" opacity="0.7" />
          </>
        ) : kind === "globe" ? (
          <>
            <circle cx="48" cy="48" r="26" />
            <ellipse cx="48" cy="48" rx="11" ry="26" />
            <path d="M23 40h50M23 56h50" opacity="0.7" />
            <path d="M30 30c10 6 26 6 36 0" opacity="0.5" />
          </>
        ) : (
          <>
            <path d="M30 66V58M42 66V50M54 66V40M66 66V30" />
            <path d="M24 34a34 34 0 0 1 20-10" opacity="0.5" />
            <path d="M28 40a26 26 0 0 1 14-8" opacity="0.7" />
          </>
        )}
      </g>
    </svg>
  );
}
