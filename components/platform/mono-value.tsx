"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** ICCIDs, IDs and codes: Geist Mono, tabular figures, with a copy button (spec 9). */
export function MonoValue({
  value,
  label,
  copy = true,
  group,
  className,
}: {
  value: string;
  /** What is copied, for the toast ("ICCID copied"). */
  label?: string;
  copy?: boolean;
  /** Split into groups of N characters for readability (display only). */
  group?: number;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const shown = group ? value.replace(new RegExp(`(.{${group}})(?!$)`, "g"), "$1 ") : value;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <span className="truncate font-mono tabular">{shown}</span>
      {copy ? (
        <button
          type="button"
          aria-label={`Copy ${label ?? "value"}`}
          className="grid size-7 shrink-0 place-items-center rounded-[8px] text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
            } catch {
              /* clipboard unavailable: still confirm visually */
            }
            setCopied(true);
            toast.success(`${label ?? "Value"} copied`);
            setTimeout(() => setCopied(false), 1400);
          }}
        >
          {copied ? <Check className="size-3.5 text-accent" strokeWidth={1.5} /> : <Copy className="size-3.5" strokeWidth={1.5} />}
        </button>
      ) : null}
    </span>
  );
}
