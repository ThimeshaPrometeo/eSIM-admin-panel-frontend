"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose } from "lucide-react";
import { cn } from "@/lib/utils";
import { findTab, type NavSection } from "@/lib/platform/nav-config";
import { SECTION_COLUMN_WIDTH } from "@/lib/platform/nav-layout";
import { NavIndicatorList } from "./nav-indicator";

/**
 * Desktop secondary column: the tabs of the section in view, with a button
 * (and the "[" shortcut) that collapses it. Only multi-tab sections have one.
 */
export function SecondaryColumn({ section, onCollapse, hidden }: { section: NavSection | null; onCollapse: () => void; hidden?: boolean }) {
  const pathname = usePathname();
  if (!section) return null;
  const active = findTab([section], pathname)?.tab.id ?? null;
  return (
    <aside
      className="glass-rail flex h-dvh shrink-0 flex-col border-r border-border px-3 py-6"
      style={{ width: SECTION_COLUMN_WIDTH }}
      inert={hidden || undefined}
      aria-hidden={hidden || undefined}
    >
      <div className="flex items-center justify-between gap-2 pl-3">
        <p className="truncate text-body font-semibold">{section.label}</p>
        <button
          type="button"
          onClick={onCollapse}
          className="grid size-8 shrink-0 place-items-center rounded-control text-fg-3 transition-colors hover:bg-surface-3/60 hover:text-fg focus-visible:outline-2 focus-visible:outline-primary"
          aria-label="Collapse the section menu"
          title="Collapse the section menu ( [ )"
        >
          <PanelLeftClose className="size-4" strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
      <nav aria-label={section.label} className="mt-4 min-h-0 flex-1 overflow-y-auto">
        <NavIndicatorList watch={`${section.id}:${active}`} className="flex flex-col gap-1">
          {section.tabs.map((t) => (
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
            </Link>
          ))}
        </NavIndicatorList>
      </nav>
    </aside>
  );
}
