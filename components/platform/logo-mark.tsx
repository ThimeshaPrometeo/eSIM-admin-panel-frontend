import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * The product mark (no company name: the brand name and logo come from
 * tenant settings later, white-label). Azure → Emerald line SIM.
 */
export function LogoMark({ className, title = "eSIM platform" }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} role="img" aria-label={title}>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="none" stroke={`url(#${id}-g)`} strokeWidth="1.5" />
      <path d="M11 8.5h8l4.5 4.5v10a1 1 0 0 1-1 1H11a1 1 0 0 1-1-1v-13.5a1 1 0 0 1 1-1Z" fill="none" stroke={`url(#${id}-g)`} strokeWidth="1.5" />
      <rect x="13" y="15.5" width="6" height="5" rx="1.2" fill="none" stroke={`url(#${id}-g)`} strokeWidth="1.25" />
    </svg>
  );
}
