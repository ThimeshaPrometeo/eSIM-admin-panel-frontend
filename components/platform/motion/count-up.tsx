"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { DURATION, easeOutExpo } from "@/lib/design/motion";
import { useReducedMotion } from "./use-reduced-motion";

/**
 * Counts up once from 0 when first shown (spec 7.6: dashboard numbers), then
 * follows value changes with the same easing.
 */
export function CountUp({
  value,
  format = (n) => Math.round(n).toLocaleString("en-GB"),
  duration = DURATION.countUp,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(0);
  const from = useRef(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (reduced) {
      from.current = value;
      return;
    }
    let frame = 0;
    const run = () => {
      const start = performance.now();
      const a = from.current;
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const v = a + (value - a) * easeOutExpo(t);
        setDisplay(v);
        from.current = v;
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    if (started.current) {
      run();
      return () => cancelAnimationFrame(frame);
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        started.current = true;
        io.disconnect();
        run();
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, duration, reduced]);

  const shown = reduced ? value : display;
  return (
    <span ref={ref} className={cn("tabular", className)} aria-label={format(value)}>
      <span aria-hidden="true">{format(shown)}</span>
    </span>
  );
}
