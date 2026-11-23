"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/** Toggles slide with weight (spec 7.6): 260 ms on the movement easing, no overshoot. */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border border-border-strong bg-surface-3 outline-none transition-[background-color,border-color,box-shadow] duration-[260ms] ease-in-out focus-visible:shadow-[0_0_0_3px_var(--primary-glow)] disabled:cursor-not-allowed disabled:opacity-40 data-[state=checked]:border-transparent data-[state=checked]:bg-primary-solid data-[state=checked]:shadow-[0_0_16px_-2px_var(--primary-glow)]",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-[18px] translate-x-[2px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-transform duration-[260ms] ease-in-out data-[state=checked]:translate-x-[18px]" />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
