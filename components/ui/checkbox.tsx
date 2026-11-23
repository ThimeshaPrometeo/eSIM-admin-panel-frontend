"use client";

import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer grid size-[18px] shrink-0 place-items-center rounded-[6px] border border-border-strong bg-surface-1/60 outline-none transition-[background-color,border-color,box-shadow] duration-[180ms] focus-visible:shadow-[0_0_0_3px_var(--primary-glow)] disabled:opacity-40 data-[state=checked]:border-transparent data-[state=checked]:bg-primary-solid data-[state=checked]:text-on-solid",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="size-3.5" strokeWidth={2.5} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
