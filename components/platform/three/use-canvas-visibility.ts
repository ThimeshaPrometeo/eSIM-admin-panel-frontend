"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * True while the element is on screen and the tab is visible. The render loop
 * pauses otherwise (spec 7.7).
 */
export function useCanvasVisibility(ref: RefObject<HTMLElement | null>) {
  const [onScreen, setOnScreen] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => setOnScreen(entries.some((e) => e.isIntersecting)), {
      rootMargin: "120px",
    });
    io.observe(el);
    const onVis = () => setTabVisible(document.visibilityState === "visible");
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ref]);

  return onScreen && tabVisible;
}
