"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PortalContainerContext } from "@/components/ui/portal-container";
import { AmbientBackground } from "@/components/platform/ambient-background";
import { Reveal } from "@/components/platform/motion/reveal";

export type Theme = "dark" | "light";

/**
 * A themed pane: tokens resolve to its theme, and floating layers (menus,
 * selects, tooltips, dialogs) opened inside it mount inside it, so they take
 * the same theme.
 */
export function ThemePane({ theme, children, className, flush }: { theme: Theme; children: ReactNode; className?: string; flush?: boolean }) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  return (
    <div
      ref={setRoot}
      data-theme={theme}
      className={cn("relative isolate min-w-0 overflow-hidden rounded-shell border border-border bg-bg text-fg", !flush && "p-4 sm:p-6", className)}
    >
      <AmbientBackground fixed={false} />
      <PortalContainerContext.Provider value={root}>
        <div className="relative">{children}</div>
      </PortalContainerContext.Provider>
    </div>
  );
}

/** One design-system section: the same content in dark and light, side by side. */
export function DsSection({
  id,
  title,
  description,
  children,
  flush,
  stack,
  themes = ["dark", "light"],
  paneClassName,
}: {
  id: string;
  title: string;
  description?: string;
  children: (theme: Theme) => ReactNode;
  flush?: boolean;
  /** Dark and light one above the other, full width (for full-page layouts). */
  stack?: boolean;
  /** Which themes to show (the sign-in page is dark only). */
  themes?: Theme[];
  paneClassName?: string;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <Reveal>
        <div className="mb-5 max-w-3xl">
          <h2 className="text-section font-semibold">{title}</h2>
          {description ? <p className="mt-1 text-body text-fg-2">{description}</p> : null}
        </div>
        <div className={stack ? "grid gap-6" : "grid gap-4 xl:grid-cols-2"}>
          {themes.map((t) => (
            <div key={t} className="min-w-0">
              <p className="mb-2 text-small text-fg-3">{t === "dark" ? "Dark (primary)" : "Light"}</p>
              <ThemePane theme={t} flush={flush} className={paneClassName}>
                {children(t)}
              </ThemePane>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

export function SubLabel({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-small text-fg-3">{children}</p>;
}
