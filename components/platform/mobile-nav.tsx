"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { findTab, type NavSection } from "@/lib/platform/nav-config";
import { cn } from "@/lib/utils";

/** Phones and tablets: the current section's tabs as a scrollable strip under the top bar. */
export function MobileSecondaryNav({ section }: { section: NavSection | null }) {
  const pathname = usePathname();
  if (!section || section.tabs.length < 2) return null;
  const active = findTab([section], pathname)?.tab.id;
  return (
    <nav aria-label={section.label} className="glass-bar sticky top-16 z-30 -mt-px border-b border-border lg:hidden">
      <div className="flex gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:none]">
        {section.tabs.map((t) =>
          t.ready ? (
            <Link
              key={t.id}
              href={t.href}
              aria-current={t.id === active ? "page" : undefined}
              className={cn(
                "flex h-9 shrink-0 items-center rounded-full px-3.5 text-body font-medium transition-colors",
                t.id === active ? "bg-surface-3 text-fg shadow-[inset_0_1px_0_var(--highlight),0_0_0_1px_var(--border)]" : "text-fg-2 hover:text-fg",
              )}
            >
              {t.label}
            </Link>
          ) : (
            <span key={t.id} aria-disabled="true" className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-body text-fg-3">
              {t.label}
              <span className="text-[11px]">· Soon</span>
            </span>
          ),
        )}
      </div>
    </nav>
  );
}

/** Phones and tablets: sections at the bottom; with more than five, the last slot opens the rest. */
export function MobileBottomNav({ sections, activeId }: { sections: NavSection[]; activeId: string | null }) {
  const [more, setMore] = useState(false);
  const overflow = sections.length > 5;
  const shown = overflow ? sections.slice(0, 4) : sections;
  const rest = overflow ? sections.slice(4) : [];
  const restActive = rest.some((s) => s.id === activeId);
  return (
    <>
      <nav aria-label="Sections" className="glass-bar fixed inset-x-0 bottom-0 z-40 border-t border-border pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className="mx-auto flex max-w-xl items-stretch justify-around px-2">
          {shown.map((s) => {
            const active = s.id === activeId;
            const first = s.tabs.find((t) => t.ready) ?? s.tabs[0]!;
            return (
              <li key={s.id} className="flex-1">
                <Link href={first.href} aria-current={active ? "page" : undefined} className={cn("flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium", active ? "text-fg" : "text-fg-3")}>
                  <s.icon className={cn("size-5", active && "text-primary drop-shadow-[0_0_8px_var(--primary-glow)]")} strokeWidth={1.5} aria-hidden="true" />
                  {s.short}
                </Link>
              </li>
            );
          })}
          {overflow ? (
            <li className="flex-1">
              <button onClick={() => setMore(true)} className={cn("flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium", restActive ? "text-fg" : "text-fg-3")} aria-haspopup="dialog">
                <MoreHorizontal className={cn("size-5", restActive && "text-primary")} strokeWidth={1.5} aria-hidden="true" />
                More
              </button>
            </li>
          ) : null}
        </ul>
      </nav>
      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent side="bottom">
          <SheetTitle>More sections</SheetTitle>
          <div className="grid gap-4 overflow-y-auto">
            {rest.map((s) => (
              <div key={s.id}>
                <p className="mb-1.5 flex items-center gap-2 text-small text-fg-3">
                  <s.icon className="size-4" strokeWidth={1.5} aria-hidden="true" />
                  {s.label}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {s.tabs.map((t) =>
                    t.ready ? (
                      <Link key={t.id} href={t.href} onClick={() => setMore(false)} className="glass-card flex h-12 items-center px-4 text-body font-medium">
                        {t.label}
                      </Link>
                    ) : (
                      <span key={t.id} className="flex h-12 items-center justify-between rounded-card border border-border px-4 text-body text-fg-3">
                        {t.label}
                        <span className="text-[11px]">Soon</span>
                      </span>
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
