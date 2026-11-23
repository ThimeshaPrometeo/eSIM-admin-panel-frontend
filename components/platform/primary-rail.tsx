"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { NavSection } from "@/lib/platform/nav-config";
import { LogoMark } from "./logo-mark";
import { NavIndicatorList } from "./nav-indicator";

/** Desktop primary rail: one icon per section. Hovering an icon previews its tabs in the secondary column. */
export function PrimaryRail({
  sections,
  activeId,
  onHover,
}: {
  sections: NavSection[];
  activeId: string | null;
  onHover: (id: string | null) => void;
}) {
  return (
    <nav aria-label="Sections" className="glass-rail sticky top-0 z-20 flex h-dvh w-[84px] shrink-0 flex-col items-center gap-1 border-r border-border py-5">
      <Link href="/esim/dashboard" className="mb-6 grid size-11 place-items-center rounded-control focus-visible:outline-2 focus-visible:outline-primary" aria-label="Dashboard">
        <LogoMark className="size-9" />
      </Link>
      <NavIndicatorList watch={activeId} className="flex w-full flex-col items-center gap-1 px-2" indicatorClassName="!rounded-[14px]">
        {sections.map((s) => {
          const active = s.id === activeId;
          const first = s.tabs.find((t) => t.ready) ?? s.tabs[0]!;
          return (
            <Link
              key={s.id}
              href={first.href}
              onMouseEnter={() => onHover(s.id)}
              onFocus={() => onHover(s.id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative z-10 flex w-full flex-col items-center gap-1 rounded-[14px] px-1 py-2.5 text-center transition-colors duration-[180ms] focus-visible:outline-2 focus-visible:outline-primary",
                active ? "text-fg" : "text-fg-3 hover:text-fg",
              )}
            >
              <s.icon className={cn("size-5 transition-colors", active && "text-primary drop-shadow-[0_0_8px_var(--primary-glow)]")} strokeWidth={1.5} aria-hidden="true" />
              <span className="text-[11px] font-medium leading-tight">{s.short}</span>
            </Link>
          );
        })}
      </NavIndicatorList>
    </nav>
  );
}
