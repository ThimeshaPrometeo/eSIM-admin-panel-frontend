"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type TransitionEvent } from "react";
import { Wallet } from "lucide-react";
import { usePlatform } from "@/contexts/platform-context";
import { Skeleton } from "@/components/ui/skeleton";
import { findTab, routeAccess, visibleNav, type NavSection } from "@/lib/platform/nav-config";
import {
  endNavResize,
  initialNavCollapsed,
  isNavToggleKey,
  NAV_TRANSITION_MS,
  readNavCollapsed,
  SECTION_COLUMN_WIDTH,
  startNavResize,
  writeNavCollapsed,
} from "@/lib/platform/nav-layout";
import { can } from "@/lib/platform/permissions";
import { formatMoney } from "@/lib/platform/money";
import { cn } from "@/lib/utils";
import { AmbientBackground } from "./ambient-background";
import { DemoBadge } from "./demo-badge";
import { LogoMark } from "./logo-mark";
import { MobileBottomNav, MobileSecondaryNav } from "./mobile-nav";
import { NotificationBell } from "./notification-bell";
import { PrimaryRail } from "./primary-rail";
import { AccessDenied } from "./route-states";
import { SecondaryColumn } from "./secondary-column";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

/**
 * The workspace frame (spec 5.4, SIP panel structure): desktop primary rail
 * + secondary column + top bar with a "Section / Page" breadcrumb. Only
 * sections with several tabs have the column; it collapses with its button
 * or "[" (remembered per user; collapsed by default below 1440px), and then
 * the rail opens a section's tabs in a floating panel; phones and tablets a top bar, section tabs
 * and bottom navigation. Also the route guard (routes.md §5): signed out →
 * sign in with ?next=, forced password change → that screen, no permission
 * → access denied in place.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { status, me, isDemo, wallet } = usePlatform();
  const pathname = usePathname();
  const router = useRouter();
  const [hovered, setHovered] = useState<string | null>(null);

  const nav = useMemo(() => (me ? visibleNav(me.role, me.permissions) : []), [me]);
  const current = findTab(nav, pathname);
  const access = me ? routeAccess(me.role, me.permissions, pathname) : null;

  // ---- the section column: only for sections with several tabs; collapsible
  const userId = me?.id ?? null;
  // the signed-in shell only renders in the browser, so the saved choice and the viewport are known here
  const initial = useMemo(() => (userId && typeof window !== "undefined" ? initialNavCollapsed(readNavCollapsed(userId), window.innerWidth) : false), [userId]);
  const [toggled, setToggled] = useState<{ userId: string; collapsed: boolean } | null>(null);
  const collapsed = toggled && toggled.userId === userId ? toggled.collapsed : initial;
  const hasColumn = isMulti(current?.section);
  const docked = hasColumn && !collapsed;
  const preview = nav.find((s) => s.id === hovered && isMulti(s));
  const shownSection = docked ? (preview ?? current?.section ?? null) : null;
  // keep the last section in the column while it closes, so it slides away instead of emptying
  const [lastShown, setLastShown] = useState<NavSection | null>(null);
  if (shownSection && shownSection !== lastShown) setLastShown(shownSection);

  const toggleColumn = () => {
    if (!userId || !hasColumn) return;
    setToggled({ userId, collapsed: !collapsed });
    writeNavCollapsed(userId, !collapsed);
  };
  const toggleRef = useRef(toggleColumn);
  useEffect(() => {
    toggleRef.current = toggleColumn;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isNavToggleKey(e) || !window.matchMedia("(min-width: 1024px)").matches) return;
      e.preventDefault();
      toggleRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- width animation: charts hold their size until it ends, then measure once
  const column = useRef<HTMLDivElement>(null);
  const [animated, setAnimated] = useState(false);
  const firstDock = useRef(true);
  useLayoutEffect(() => {
    if (status !== "signed_in") return;
    if (firstDock.current) {
      // the first layout takes its width at once (no animation on load)
      firstDock.current = false;
      return;
    }
    startNavResize();
    const t = setTimeout(endNavResize, NAV_TRANSITION_MS + 150);
    return () => clearTimeout(t);
  }, [docked, status]);
  useEffect(() => {
    if (status !== "signed_in") return;
    const id = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(id);
  }, [status]);
  const onColumnTransitionEnd = (e: TransitionEvent<HTMLDivElement>) => {
    if (e.target === column.current && e.propertyName === "width") endNavResize();
  };

  useEffect(() => {
    if (status === "signed_out") router.replace(`/?next=${encodeURIComponent(pathname)}`);
    else if (me?.mustChangePassword) router.replace("/login/change-password");
  }, [status, me, pathname, router]);

  if (status !== "signed_in" || !me || me.mustChangePassword) return <ShellSkeleton />;

  const showWallet = (me.role === "reseller" || me.role === "assistant") && wallet && can(me.permissions, "wallets");

  return (
    <div className="relative min-h-dvh lg:flex">
      <AmbientBackground />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-primary-solid focus:px-4 focus:py-2 focus:text-on-solid">
        Skip to content
      </a>

      <div className="hidden lg:flex" onMouseLeave={() => setHovered(null)}>
        <PrimaryRail sections={nav} activeId={current?.section.id ?? null} docked={docked} onPreview={setHovered} onExpand={hasColumn && !docked ? toggleColumn : undefined} />
        <div
          ref={column}
          data-nav-column={docked ? "open" : "closed"}
          className={cn("sticky top-0 z-20 h-dvh shrink-0 overflow-hidden", animated && "nav-column")}
          style={{ width: docked ? SECTION_COLUMN_WIDTH : 0 }}
          onTransitionEnd={onColumnTransitionEnd}
        >
          <SecondaryColumn section={shownSection ?? lastShown} onCollapse={toggleColumn} hidden={!docked} />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* top bar */}
        <header className="glass-bar sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border px-4 md:px-8 lg:border-b-0 lg:bg-transparent lg:px-10 lg:backdrop-blur-none">
          <Link href="/esim/dashboard" className="lg:hidden" aria-label="Dashboard">
            <LogoMark />
          </Link>
          {current ? (
            <nav aria-label="Breadcrumb" className="min-w-0">
              <ol className="flex min-w-0 items-center gap-2 text-body text-fg-3">
                <li className="hidden min-w-0 truncate sm:block">
                  {current.section.tabs[0]!.href !== current.tab.href ? (
                    <Link href={current.section.tabs[0]!.href} className="rounded transition-colors hover:text-fg-2 focus-visible:outline-2 focus-visible:outline-primary">
                      {current.section.label}
                    </Link>
                  ) : (
                    current.section.label
                  )}
                </li>
                <li aria-hidden="true" className="hidden sm:block">
                  /
                </li>
                <li className="min-w-0 truncate text-fg-2" aria-current="page">
                  {current.tab.label}
                </li>
              </ol>
            </nav>
          ) : null}
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {isDemo ? <DemoBadge className="hidden sm:inline-flex" /> : null}
            {showWallet ? (
              <Link
                href="/esim/wallet"
                className="hidden h-9 items-center gap-2 rounded-full border border-border px-3 text-small text-fg-2 transition-colors hover:border-border-strong hover:text-fg md:inline-flex"
              >
                <Wallet className="size-4" strokeWidth={1.5} aria-hidden="true" />
                <span>Available</span>
                <span className="font-medium text-fg tabular">{formatMoney(wallet.available)}</span>
              </Link>
            ) : null}
            <NotificationBell />
            <span className="hidden sm:block">
              <ThemeToggle />
            </span>
            <UserMenu />
          </div>
        </header>
        {isDemo ? (
          <div className="flex justify-center border-b border-border py-1.5 sm:hidden">
            <DemoBadge />
          </div>
        ) : null}
        <MobileSecondaryNav section={current?.section ?? null} />

        <main id="main" className={cn("min-w-0 flex-1 px-4 pb-28 pt-6 md:px-8 lg:px-10 lg:pb-6 lg:pt-4")}>
          <div className="mx-auto w-full max-w-[1600px]">
            {access?.kind === "denied" ? <AccessDenied /> : children}
          </div>
        </main>
      </div>

      <MobileBottomNav sections={nav} activeId={current?.section.id ?? null} />
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="relative min-h-dvh lg:flex" aria-busy="true" aria-label="Loading your workspace">
      <AmbientBackground />
      <div className="glass-rail hidden h-dvh w-[84px] shrink-0 border-r border-border lg:block" />
      <div className="flex-1 px-4 pt-20 md:px-8 lg:px-10">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-6">
          <Skeleton className="h-9 w-56" />
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-72" />
        </div>
      </div>
    </div>
  );
}

const isMulti = (s: NavSection | null | undefined) => !!s && s.tabs.length > 1;
