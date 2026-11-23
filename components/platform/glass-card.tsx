"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useCursorGlow } from "./motion/use-cursor-glow";

/**
 * Glass card (spec 7.4): glass fill, backdrop blur, thin border, 1px top
 * highlight, radius 16. `interactive` adds the hover/focus glow and the
 * cursor light; plain cards never glow.
 */
export function GlassCard({
  interactive,
  padded = true,
  className,
  onPointerMove,
  onPointerLeave,
  ...props
}: React.ComponentProps<"div"> & { interactive?: boolean; padded?: boolean }) {
  const glow = useCursorGlow<HTMLDivElement>();
  return (
    <div
      className={cn(
        "glass-card",
        interactive && "glass-card-interactive cursor-glow",
        padded && "p-4 sm:p-6",
        className,
      )}
      onPointerMove={(e) => {
        if (interactive) glow.onPointerMove(e);
        onPointerMove?.(e);
      }}
      onPointerLeave={(e) => {
        if (interactive) glow.onPointerLeave(e);
        onPointerLeave?.(e);
      }}
      {...props}
    />
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <GlassCard className={className}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-section font-semibold">{title}</h2>
          {description ? <p className="mt-1 text-body text-fg-2">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </GlassCard>
  );
}
