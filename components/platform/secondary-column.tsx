"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { findTab, type NavSection } from "@/lib/platform/nav-config";
import { NavIndicatorList } from "./nav-indicator";

/** Desktop secondary column: the tabs of the section in view. */
export function SecondaryColumn({ section }: { section: NavSection | null }) {
  const pathname = usePathname();
  if (!section) return null;
  const active = findTab([section], pathname)?.tab.id ?? null;
  return (
    <aside className="glass-rail sticky top-0 z-10 flex h-dvh w-[232px] shrink-0 flex-col border-r border-border px-3 py-6">
      <p className="px-3 text-body font-semibold">{section.label}</p>
      <nav aria-label={section.label} className="mt-5 min-h-0 flex-1 overflow-y-auto">
        <NavIndicatorList watch={`${section.id}:${active}`} className="flex flex-col gap-1">
          {section.tabs.map((t) =>
            <Link
                key={t.id}
                href={t.href}
                aria-current={t.id === active ? "page" : undefined}
                className={cn(
                  "relative z-10 flex h-10 items-center rounded-control px-3 text-body font-medium transition-colors duration-[180ms] focus-visible:outline-2 focus-visible:outline-primary",
                  t.id === active ? "text-fg" : "text-fg-2 hover:text-fg",
                )}
              >
                {t.id === active ? <span aria-hidden="true" className="mr-2.5 size-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" /> : null}
                {t.label}
              </Link>,
          )}
        </NavIndicatorList>
      </nav>
    </aside>
  );
}
