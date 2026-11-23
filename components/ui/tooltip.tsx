"use client";

import * as React from "react";
import { Tooltip as T } from "radix-ui";
import { cn } from "@/lib/utils";
import { usePortalContainer } from "./portal-container";

const TooltipProvider = T.Provider;

function Tooltip({ content, children, side = "top" }: { content: React.ReactNode; children: React.ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <T.Root delayDuration={250}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal container={usePortalContainer()}>
        <T.Content
          side={side}
          sideOffset={6}
          className={cn(
            "glass-pop z-50 max-w-64 rounded-[10px] px-3 py-1.5 text-small text-fg data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}

export { Tooltip, TooltipProvider };
