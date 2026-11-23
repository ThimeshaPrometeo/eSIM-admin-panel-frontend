"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Wallet } from "lucide-react";
import { usePlatform } from "@/contexts/platform-context";
import { Skeleton } from "@/components/ui/skeleton";
import { findTab, routeAccess, visibleNav } from "@/lib/platform/nav-config";
import { can } from "@/lib/platform/permissions";
import { formatMoney } from "@/lib/platform/money";
import { cn } from "@/lib/utils";
import { AmbientBackground } from "./ambient-background";
import { DemoBadge } from "./demo-badge";
import { LogoMark } from "./logo-mark";
import { MobileBottomNav, MobileSecondaryNav } from "./mobile-nav";
import { NotificationBell } from "./notification-bell";
import { PrimaryRail } from "./primary-rail";
import { AccessDenied, ComingSoon } from "./route-states";
import { SecondaryColumn } from "./secondary-column";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

/**
 * The workspace frame (spec 5.4, SIP panel structure): desktop primary rail
 * + secondary column + top bar; phones and tablets a top bar, section tabs
 * and bottom navigation. Also the route guard (routes.md §5): signed out →
 * sign in with ?next=, forced password change → that screen, no permission
 * → access denied in place, not built yet → coming soon.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { status, me, isDemo, wallet } = usePlatform();
  const pathname = usePathname();
  const router = useRouter();
  const [hovered, setHovered] = useState<string | null>(null);

  const nav = useMemo(() => (me ? visibleNav(me.role, me.permissions) : []), [me]);
  const current = findTab(nav, pathname);
  const access = me ? routeAccess(me.role, me.permissions, pathname) : null;
  const shownSection = nav.find((s) => s.id === (hovered ?? current?.section.id)) ?? current?.section ?? null;

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
        <PrimaryRail sections={nav} activeId={current?.section.id ?? null} onHover={setHovered} />
        <SecondaryColumn section={shownSection} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* top bar */}
        <header className="glass-bar sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border px-4 md:px-8 lg:border-b-0 lg:bg-transparent lg:px-10 lg:backdrop-blur-none">
          <Link href="/esim/dashboard" className="lg:hidden" aria-label="Dashboard">
            <LogoMark />
          </Link>
          <p className="min-w-0 truncate text-body text-fg-3">
            {current ? (
              <>
                <span className="hidden sm:inline">{current.section.label}</span>
                <span className="hidden sm:inline" aria-hidden="true">
                  {"  /  "}
                </span>
                <span className="text-fg-2">{current.tab.label}</span>
              </>
            ) : null}
          </p>
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
          <div className="mx-auto w-full max-w-[1240px]">
            {access?.kind === "denied" ? <AccessDenied /> : access?.kind === "coming_soon" ? <ComingSoon title={access.tab.label} /> : children}
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
      <div className="glass-rail hidden h-dvh w-[232px] shrink-0 border-r border-border lg:block" />
      <div className="flex-1 px-4 pt-20 md:px-8 lg:px-10">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-6">
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
