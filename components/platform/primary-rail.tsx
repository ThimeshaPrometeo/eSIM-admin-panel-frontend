"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { findTab, type NavSection } from "@/lib/platform/nav-config";
import { LogoMark } from "./logo-mark";
import { NavIndicatorList } from "./nav-indicator";

/** Hover delays: open after a short pause (no flicker while passing over), close a little later (time to reach the panel). */
const OPEN_DELAY = 140;
const CLOSE_DELAY = 220;
const RAIL_WIDTH = 84;

const itemClass = (active: boolean) =>
  cn(
    "relative z-10 flex w-full flex-col items-center gap-1 rounded-[14px] px-1 py-2.5 text-center transition-colors duration-[180ms] focus-visible:outline-2 focus-visible:outline-primary",
    active ? "text-fg" : "text-fg-3 hover:text-fg",
  );

/**
 * Desktop primary rail: one icon per section.
 *  - Single-tab sections: the icon goes straight to the page.
 *  - Multi-tab sections with the column docked: the icon goes to the first
 *    tab; hovering previews the section's tabs in the column.
 *  - Multi-tab sections otherwise (column collapsed, or the page has no
 *    column): hovering or clicking opens the tabs in a floating glass panel.
 */
export function PrimaryRail({
  sections,
  activeId,
  docked,
  onPreview,
  onExpand,
}: {
  sections: NavSection[];
  activeId: string | null;
  /** The section column is open: previews go there instead of a floating panel. */
  docked: boolean;
  onPreview: (id: string | null) => void;
  /** Shown when the column is collapsed on a page that has one. */
  onExpand?: () => void;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState<{ id: string; top: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const panel = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  });

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const show = useCallback((id: string, focusFirst = false) => {
    clear();
    const el = triggers.current.get(id);
    const r = el?.getBoundingClientRect();
    setOpen({ id, top: r ? r.top : 80 });
    if (focusFirst) requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>("a")?.focus());
  }, []);
  const close = useCallback((returnFocus = false) => {
    clear();
    const o = openRef.current;
    if (o && returnFocus) triggers.current.get(o.id)?.focus();
    setOpen(null);
  }, []);
  const later = (fn: () => void, ms: number) => {
    clear();
    timer.current = setTimeout(fn, ms);
  };

  // a new page, or the column docking: no floating panel
  const placeKey = `${pathname}|${docked}`;
  const [place, setPlace] = useState(placeKey);
  if (place !== placeKey) {
    setPlace(placeKey);
    if (open) setOpen(null);
  }
  useEffect(() => clear, []);

  const onTriggerKey = (id: string) => (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      show(id, true);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      close(true);
    }
  };
  const onTriggerClick = (id: string) => (e: MouseEvent<HTMLButtonElement>) => {
    // keyboard (Enter / Space) also moves focus into the panel
    if (open?.id === id && e.detail > 0) close();
    else show(id, e.detail === 0);
  };

  const onPanelKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const links = [...(panel.current?.querySelectorAll<HTMLElement>("a") ?? [])];
    const i = links.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = links.length;
      links[(i + (e.key === "ArrowDown" ? 1 : -1) + n) % n]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      (e.key === "Home" ? links[0] : links[links.length - 1])?.focus();
    }
  };

  const openSection = open ? sections.find((s) => s.id === open.id) : null;
  const activeTab = openSection ? findTab([openSection], pathname)?.tab.id : null;
  // keep the panel on screen
  const panelTop = open ? Math.max(12, Math.min(open.top - 8, (typeof window === "undefined" ? 800 : window.innerHeight) - 24 - (openSection?.tabs.length ?? 0) * 40 - 56)) : 0;

  return (
    <nav aria-label="Sections" className="glass-rail sticky top-0 z-30 flex h-dvh w-[84px] shrink-0 flex-col items-center gap-1 border-r border-border py-5">
      <Link href="/esim/dashboard" className="mb-6 grid size-11 place-items-center rounded-control focus-visible:outline-2 focus-visible:outline-primary" aria-label="Dashboard">
        <LogoMark className="size-9" />
      </Link>
      <NavIndicatorList watch={activeId} className="flex w-full flex-col items-center gap-1 px-2" indicatorClassName="!rounded-[14px]">
        {sections.map((s) => {
          const active = s.id === activeId;
          const multi = s.tabs.length > 1;
          const content = (
            <>
              <s.icon className={cn("size-5 transition-colors", active && "text-primary drop-shadow-[0_0_8px_var(--primary-glow)]")} strokeWidth={1.5} aria-hidden="true" />
              <span className="text-[11px] font-medium leading-tight">{s.short}</span>
            </>
          );
          if (multi && !docked)
            return (
              <button
                key={s.id}
                ref={(el) => {
                  if (el) triggers.current.set(s.id, el);
                  else triggers.current.delete(s.id);
                }}
                type="button"
                data-current={active ? "" : undefined}
                aria-expanded={open?.id === s.id}
                aria-controls={open?.id === s.id ? "nav-flyout" : undefined}
                aria-label={`${s.label}${active ? " (current section)" : ""}`}
                onMouseEnter={() => later(() => show(s.id), open ? 60 : OPEN_DELAY)}
                onMouseLeave={() => later(() => close(), CLOSE_DELAY)}
                onClick={onTriggerClick(s.id)}
                onKeyDown={onTriggerKey(s.id)}
                className={itemClass(active)}
              >
                {content}
              </button>
            );
          return (
            <Link
              key={s.id}
              href={s.tabs[0]!.href}
              onMouseEnter={() => onPreview(multi ? s.id : null)}
              onFocus={() => onPreview(multi ? s.id : null)}
              onMouseLeave={() => !multi && onPreview(null)}
              aria-current={active ? "page" : undefined}
              className={itemClass(active)}
            >
              {content}
            </Link>
          );
        })}
      </NavIndicatorList>

      {onExpand ? (
        <button
          type="button"
          onClick={onExpand}
          className="mt-3 grid size-10 place-items-center rounded-control border-t border-border text-fg-3 transition-colors hover:bg-surface-3/60 hover:text-fg focus-visible:outline-2 focus-visible:outline-primary"
          aria-label="Expand the section menu"
          title="Expand the section menu ( [ )"
        >
          <PanelLeftOpen className="size-[18px]" strokeWidth={1.5} aria-hidden="true" />
        </button>
      ) : null}

      {openSection ? (
        <div
          id="nav-flyout"
          ref={panel}
          role="region"
          aria-label={`${openSection.label} pages`}
          onMouseEnter={clear}
          onMouseLeave={() => later(() => close(), CLOSE_DELAY)}
          onKeyDown={onPanelKey}
          onBlur={(e) => {
            const to = e.relatedTarget as Node | null;
            if (to && (panel.current?.contains(to) || triggers.current.get(openSection.id)?.contains(to))) return;
            close();
          }}
          className="nav-flyout glass-pop fixed z-40 w-[232px] rounded-card p-2"
          style={{ left: RAIL_WIDTH + 8, top: panelTop }}
        >
          <p className="px-3 pb-1.5 pt-1 text-small font-semibold text-fg-2">{openSection.label}</p>
          <ul className="flex flex-col gap-0.5">
            {openSection.tabs.map((t) => (
              <li key={t.id}>
                <Link
                  href={t.href}
                  onClick={() => close()}
                  aria-current={t.id === activeTab ? "page" : undefined}
                  className={cn(
                    "flex h-9 items-center rounded-control px-3 text-body font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                    t.id === activeTab ? "bg-surface-3 text-fg" : "text-fg-2 hover:bg-surface-3/60 hover:text-fg",
                  )}
                >
                  {t.id === activeTab ? <span aria-hidden="true" className="mr-2.5 size-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" /> : null}
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </nav>
  );
}
