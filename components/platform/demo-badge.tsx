"use client";

import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Visible in demo mode (spec 4.1): everything shown is sample data. */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <Tooltip content="Sample data. Changes are kept in this browser only. Reset them from the user menu.">
      <span
        tabIndex={0}
        className={cn(
          "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border border-[color-mix(in_oklab,var(--warning)_35%,transparent)] bg-[color-mix(in_oklab,var(--warning)_10%,transparent)] px-2.5 text-small font-medium text-fg outline-none focus-visible:ring-2 focus-visible:ring-primary",
          className,
        )}
      >
        <span aria-hidden="true" className="size-1.5 rounded-full bg-warning shadow-[0_0_8px_var(--warning)]" />
        Demo data
      </span>
    </Tooltip>
  );
}
