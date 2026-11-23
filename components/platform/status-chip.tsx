import { cn } from "@/lib/utils";
import type { StatusInfo, StatusTone } from "@/lib/platform/status";

const TONE: Record<StatusTone, string> = {
  positive: "var(--accent)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  neutral: "var(--neutral)",
  info: "var(--primary)",
};

/**
 * Status chip with a small glowing dot (spec 7.8). The label stays in the text
 * colour, so contrast never depends on the status colour.
 */
export function StatusChip({ status, className }: { status: StatusInfo; className?: string }) {
  const c = TONE[status.tone];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-small font-medium text-fg",
        className,
      )}
      style={{
        borderColor: `color-mix(in oklab, ${c} 32%, transparent)`,
        background: `color-mix(in oklab, ${c} 10%, transparent)`,
      }}
    >
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full"
        style={{ background: c, boxShadow: status.tone === "neutral" ? undefined : `0 0 8px 1px ${c}` }}
      />
      {status.label}
    </span>
  );
}

/** "Estimated" until final (spec 9). */
export function EstimatedChip({ className }: { className?: string }) {
  return <StatusChip status={{ label: "Estimated", tone: "warning" }} className={className} />;
}
