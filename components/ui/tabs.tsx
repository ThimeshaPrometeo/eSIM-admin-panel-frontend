"use client";

import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * Tabs with an active indicator that glides between tabs (spec 7.6). The
 * indicator is measured from the active trigger and moved with a transform.
 */
function Tabs(props: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" {...props} />;
}

function TabsList({ className, children, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [box, setBox] = React.useState<{ x: number; w: number } | null>(null);

  React.useLayoutEffect(() => {
    const list = ref.current;
    if (!list) return;
    const measure = () => {
      const active = list.querySelector<HTMLElement>('[data-state="active"]');
      if (active) setBox({ x: active.offsetLeft, w: active.offsetWidth });
    };
    measure();
    const mo = new MutationObserver(measure);
    mo.observe(list, { attributes: true, subtree: true, attributeFilter: ["data-state"] });
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => {
      mo.disconnect();
      ro.disconnect();
    };
  }, []);

  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn("glass-card relative inline-flex h-10 items-center gap-1 !rounded-full p-1", className)}
      {...props}
    >
      {box ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-0 rounded-full bg-surface-3 shadow-[inset_0_1px_0_var(--highlight),0_0_0_1px_var(--border-strong)] transition-[transform,width] duration-500 ease-in-out"
          style={{ width: box.w, transform: `translateX(${box.x}px)` }}
        />
      ) : null}
      {children}
    </TabsPrimitive.List>
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative z-10 inline-flex h-8 items-center gap-2 rounded-full px-4 text-body font-medium text-fg-2 outline-none transition-colors duration-[180ms] hover:text-fg focus-visible:ring-2 focus-visible:ring-primary data-[state=active]:text-fg [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("mt-6 outline-none", className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
