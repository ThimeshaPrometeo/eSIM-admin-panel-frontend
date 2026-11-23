"use client";

import { useEffect, useRef } from "react";
import { damp } from "@/lib/design/motion";

export type LerpedPointer = {
  /** Smoothed position, -1..1 on each axis (0 = centre). */
  x: number;
  y: number;
  /** Raw target position. */
  tx: number;
  ty: number;
  /** True while the pointer is over the target (or anywhere, for window). */
  active: boolean;
};

/**
 * Pointer position with weighted inertia (spec 7.6: mouse-reactive elements
 * move with inertia, never 1:1). The value lives in a ref and is read inside
 * the consumer's own animation loop, so it never re-renders React.
 *
 * Pass an element ref to track the pointer relative to it, or nothing for the
 * whole window. Call `step(dt)` once per frame from the consumer's loop.
 */
export function useLerpedPointer(target?: React.RefObject<HTMLElement | null>, smoothing = 0.02) {
  const state = useRef<LerpedPointer>({ x: 0, y: 0, tx: 0, ty: 0, active: false });

  useEffect(() => {
    const el = target?.current ?? null;
    const host: HTMLElement | Window = el ?? window;
    const onMove = (e: PointerEvent) => {
      const r = el
        ? el.getBoundingClientRect()
        : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
      state.current.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      state.current.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
      state.current.active = true;
    };
    const onLeave = () => {
      state.current.tx = 0;
      state.current.ty = 0;
      state.current.active = false;
    };
    host.addEventListener("pointermove", onMove as EventListener);
    (el ?? document.documentElement).addEventListener("pointerleave", onLeave);
    return () => {
      host.removeEventListener("pointermove", onMove as EventListener);
      (el ?? document.documentElement).removeEventListener("pointerleave", onLeave);
    };
  }, [target]);

  const step = (dt: number) => {
    const s = state.current;
    s.x = damp(s.x, s.tx, smoothing, dt);
    s.y = damp(s.y, s.ty, smoothing, dt);
    return s;
  };

  return { pointer: state, step };
}
