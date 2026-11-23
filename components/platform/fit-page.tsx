"use client";

import { createContext, useContext, type ReactNode } from "react";
import { FIT_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

const FitContext = createContext(false);

/** True inside a FitPage on a desktop screen: lists fill the space and scroll inside. */
export function useFit() {
  return useContext(FitContext);
}

/**
 * A page that fits one screen on desktop (≥ 1024 × 640): the page itself
 * doesn't scroll; the main list scrolls inside its card with a sticky header.
 * Phones and short screens scroll as usual.
 */
export function FitPage({ children, className }: { children: ReactNode; className?: string }) {
  const fit = useMediaQuery(FIT_QUERY);
  return (
    <FitContext.Provider value={fit}>
      <div className={cn("flex flex-col gap-6", fit && "h-[calc(100dvh-104px)] min-h-[520px] gap-5", className)}>{children}</div>
    </FitContext.Provider>
  );
}

/** Inside a FitPage: the part below the page's header, scrolling inside on desktop. */
export function FitScroll({ children, className }: { children: ReactNode; className?: string }) {
  const fit = useFit();
  return <div className={cn("flex flex-col gap-6", fit && "-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-2", className)}>{children}</div>;
}
