"use client";

import * as React from "react";
import { DropdownMenu as Menu } from "radix-ui";
import { cn } from "@/lib/utils";
import { usePortalContainer } from "./portal-container";

const DropdownMenu = Menu.Root;
const DropdownMenuTrigger = Menu.Trigger;

function DropdownMenuContent({ className, sideOffset = 6, ...props }: React.ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal container={usePortalContainer()}>
      <Menu.Content
        sideOffset={sideOffset}
        className={cn(
          "glass-pop z-50 min-w-48 rounded-control p-1 text-fg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          className,
        )}
        {...props}
      />
    </Menu.Portal>
  );
}

function DropdownMenuItem({ className, destructive, ...props }: React.ComponentProps<typeof Menu.Item> & { destructive?: boolean }) {
  return (
    <Menu.Item
      className={cn(
        "flex cursor-default select-none items-center gap-2.5 rounded-[8px] px-3 py-2 text-body outline-none data-[highlighted]:bg-surface-3 data-[disabled]:opacity-40 [&_svg]:size-4 [&_svg]:text-fg-3",
        destructive && "text-danger [&_svg]:text-danger",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof Menu.Label>) {
  return <Menu.Label className={cn("px-3 py-1.5 text-small text-fg-3", className)} {...props} />;
}
function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof Menu.Separator>) {
  return <Menu.Separator className={cn("my-1 h-px bg-border", className)} {...props} />;
}

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator };
