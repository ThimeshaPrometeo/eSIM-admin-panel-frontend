"use client";

import { cloneElement, useLayoutEffect, useRef, useState, type ReactElement } from "react";
import { isNavResizing, NAV_RESIZED_EVENT } from "@/lib/platform/nav-layout";

/**
 * Sizes a Recharts chart to its box (instead of ResponsiveContainer). While
 * the section column animates its width the chart keeps its size (clipped,
 * no redraw on every frame) and measures once when the animation ends, so it
 * never jumps or re-animates mid-transition.
 */
export function ChartBox({ children }: { children: ReactElement<{ width?: number; height?: number }> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      if (isNavResizing()) return;
      const w = Math.floor(el.clientWidth);
      const h = Math.floor(el.clientHeight);
      setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener(NAV_RESIZED_EVENT, measure);
    return () => {
      ro.disconnect();
      window.removeEventListener(NAV_RESIZED_EVENT, measure);
    };
  }, []);

  return (
    <div ref={ref} className="relative h-full w-full min-w-0 overflow-hidden">
      {size && size.w > 0 && size.h > 0 ? <div className="absolute left-0 top-0">{cloneElement(children, { width: size.w, height: size.h })}</div> : null}
    </div>
  );
}
