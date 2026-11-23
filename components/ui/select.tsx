"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePortalContainer } from "./portal-container";
import { fieldClass } from "./input";

const Select = SelectPrimitive.Root;
const SelectValue = SelectPrimitive.Value;
const SelectGroup = SelectPrimitive.Group;

function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(fieldClass, "flex h-10 items-center justify-between gap-2 text-left data-[placeholder]:text-fg-3 [&_svg]:size-4 [&_svg]:text-fg-3", className)}
      {...props}
    >
      <span className="truncate">{children}</span>
      <SelectPrimitive.Icon asChild>
        <ChevronDown strokeWidth={1.5} />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({ className, children, position = "popper", ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal container={usePortalContainer()}>
      <SelectPrimitive.Content
        position={position}
        sideOffset={6}
        className={cn(
          "glass-pop relative z-50 max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-hidden rounded-control p-1 text-fg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-[8px] py-2 pl-3 pr-8 text-body outline-none data-[highlighted]:bg-surface-3 data-[disabled]:opacity-40",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2.5 text-primary">
        <Check className="size-4" strokeWidth={1.5} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export { Select, SelectValue, SelectGroup, SelectTrigger, SelectContent, SelectItem };
