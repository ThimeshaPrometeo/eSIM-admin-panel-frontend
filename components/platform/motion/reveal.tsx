"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT_EXPO_CSS, REVEAL } from "@/lib/design/motion";
import { useReducedMotion } from "./use-reduced-motion";

/**
 * Fades and rises content as it enters the viewport, once per page view
 * (spec 7.6). Children of a <RevealGroup> stagger by their index.
 */
export function Reveal({
  children,
  index = 0,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  index?: number;
  className?: string;
  as?: "div" | "section" | "li";
}) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  const visible = reduced || shown;
  const style: CSSProperties = {
    opacity: visible ? 1 : 0,
    transform: visible ? "none" : `translate3d(0, ${REVEAL.rise}px, 0)`,
    transition: reduced
      ? undefined
      : `opacity ${DURATION.reveal}ms ${EASE_OUT_EXPO_CSS} ${index * REVEAL.stagger}ms, transform ${DURATION.reveal}ms ${EASE_OUT_EXPO_CSS} ${index * REVEAL.stagger}ms`,
    willChange: visible ? undefined : "opacity, transform",
  };

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={ref as any} className={cn(className)} style={style}>
      {children}
    </Tag>
  );
}

export function RevealGroup({ children, className }: { children: ReactNode[]; className?: string }) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <Reveal key={i} index={i}>
          {child}
        </Reveal>
      ))}
    </div>
  );
}
