"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePortalContainer } from "./portal-container";

/** A sheet that slides in from an edge, with the same blur-in backdrop as dialogs. */
const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;

function SheetContent({
  side = "bottom",
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { side?: "bottom" | "left" | "right" }) {
  return (
    <DialogPrimitive.Portal container={usePortalContainer()}>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[var(--scrim)] backdrop-blur-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-500 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <DialogPrimitive.Content
        className={cn(
          "glass-pop fixed z-50 flex flex-col gap-4 p-5 text-fg duration-500 ease-out-expo data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-200",
          side === "bottom" &&
            "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-[24px] !rounded-b-none pb-[calc(1.25rem+env(safe-area-inset-bottom))] data-[state=open]:slide-in-from-bottom-8 data-[state=closed]:slide-out-to-bottom-8",
          side === "left" && "inset-y-0 left-0 w-[min(320px,86vw)] !rounded-l-none data-[state=open]:slide-in-from-left-8 data-[state=closed]:slide-out-to-left-8",
          side === "right" && "inset-y-0 right-0 w-[min(420px,92vw)] !rounded-r-none data-[state=open]:slide-in-from-right-8 data-[state=closed]:slide-out-to-right-8",
          className,
        )}
        {...props}
      >
        {side === "bottom" ? <span aria-hidden="true" className="mx-auto -mt-1 h-1 w-10 shrink-0 rounded-full bg-border-strong" /> : null}
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 grid size-9 place-items-center rounded-full text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg focus-visible:outline-2 focus-visible:outline-primary">
          <X className="size-4" strokeWidth={1.5} />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("pr-10 text-section font-semibold", className)} {...props} />;
}
function SheetDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-body text-fg-2", className)} {...props} />;
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle, SheetDescription };
