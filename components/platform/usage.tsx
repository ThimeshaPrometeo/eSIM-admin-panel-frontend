"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { usageTone } from "@/lib/platform/status";

function strokeFor(fraction: number, gradientId: string) {
  const tone = usageTone(fraction);
  return tone === "danger" ? "var(--danger)" : tone === "warning" ? "var(--warning)" : `url(#${gradientId})`;
}

/**
 * Usage ring: Azure → Emerald below 80%, warning 80–99%, danger at 100%
 * (spec 7.2). The arc grows with a CSS transition.
 */
export function UsageRing({
  used,
  limit,
  size = 96,
  stroke = 7,
  label,
  className,
}: {
  used: number;
  limit: number;
  size?: number;
  stroke?: number;
  label?: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const fraction = limit > 0 ? Math.min(1, used / limit) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(fraction * 100)}% used`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--primary)" />
            <stop offset="1" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-strong)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={strokeFor(fraction, `${id}-g`)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fraction)}
          style={{
            transition: "stroke-dashoffset 900ms var(--ease-out-expo)",
            filter: "drop-shadow(0 0 6px var(--primary-glow))",
          }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        {label ?? <span className="font-semibold tabular">{Math.round(fraction * 100)}%</span>}
      </div>
    </div>
  );
}

export function UsageBar({ used, limit, className }: { used: number; limit: number; className?: string }) {
  const fraction = limit > 0 ? Math.min(1, used / limit) : 0;
  const tone = usageTone(fraction);
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fraction * 100)}
    >
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out-expo"
        style={{
          width: `${fraction * 100}%`,
          background:
            tone === "danger" ? "var(--danger)" : tone === "warning" ? "var(--warning)" : "var(--gradient-signature)",
          boxShadow: tone === "normal" ? "0 0 10px var(--primary-glow)" : undefined,
        }}
      />
    </div>
  );
}
