"use client";

import { useCallback, type PointerEvent } from "react";

/**
 * The soft light that follows the cursor across primary buttons and
 * interactive cards (spec 7.6). Pair with the `cursor-glow` class.
 */
export function useCursorGlow<T extends HTMLElement>() {
  const onPointerMove = useCallback((e: PointerEvent<T>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--glow-x", `${e.clientX - r.left}px`);
    el.style.setProperty("--glow-y", `${e.clientY - r.top}px`);
    el.style.setProperty("--glow-opacity", "1");
  }, []);
  const onPointerLeave = useCallback((e: PointerEvent<T>) => {
    e.currentTarget.style.setProperty("--glow-opacity", "0");
  }, []);
  return { onPointerMove, onPointerLeave };
}
