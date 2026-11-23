import { cn } from "@/lib/utils";

/** 4G / 5G / VoLTE flags of a network. Absent features are not shown. */
export function NetworkBadges({ lte, fiveG, volte, className }: { lte?: boolean; fiveG?: boolean; volte?: boolean; className?: string }) {
  const items = [lte && "4G", fiveG && "5G", volte && "VoLTE"].filter(Boolean) as string[];
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {items.map((label) => (
        <span
          key={label}
          className={cn(
            "inline-flex h-5 items-center rounded-[6px] border px-1.5 font-mono text-[11px] font-medium leading-none",
            label === "5G"
              ? "border-[color-mix(in_oklab,var(--accent)_40%,transparent)] text-accent"
              : "border-border-strong text-fg-2",
          )}
        >
          {label}
        </span>
      ))}
    </span>
  );
}
