"use client";

import { useSyncExternalStore } from "react";

/** True while the media query matches (false on the server). */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Desktop screens tall enough for one-screen layouts (same rule as the `fit` CSS variant). */
export const FIT_QUERY = "(min-width: 1024px) and (min-height: 640px)";
