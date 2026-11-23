"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Wraps a vertical list of nav items and glides a highlight to the item
 * marked `aria-current="page"` (spec 7.6: the active-nav indicator glides).
 */
export function NavIndicatorList({ children, className, indicatorClassName, watch }: { children: ReactNode; className?: string; indicatorClassName?: string; watch: unknown }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ y: number; h: number; x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const active = el.querySelector<HTMLElement>('[aria-current="page"]');
      setBox(active ? { y: active.offsetTop, h: active.offsetHeight, x: active.offsetLeft, w: active.offsetWidth } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [watch]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-0 top-0 rounded-control bg-surface-3 shadow-[inset_0_1px_0_var(--highlight),0_0_0_1px_var(--border)] transition-[transform,height,width,opacity] duration-500 ease-in-out",
          indicatorClassName,
        )}
        style={box ? { transform: `translate(${box.x}px, ${box.y}px)`, height: box.h, width: box.w, opacity: 1 } : { opacity: 0 }}
      />
      {children}
    </div>
  );
}
