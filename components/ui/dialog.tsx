"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePortalContainer } from "./portal-container";

/** Dialogs open with a blur-in backdrop (spec 7.6). */
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

export const dialogPanelClass =
  "glass-pop w-full max-w-[calc(100%-2rem)] rounded-card p-6 text-fg sm:max-w-lg";

function DialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal container={usePortalContainer()}>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[var(--scrim)] backdrop-blur-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-500 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <DialogPrimitive.Content
        className={cn(
          dialogPanelClass,
          "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 duration-500 ease-out-expo data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.97] data-[state=open]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.98] data-[state=closed]:duration-200",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg focus-visible:outline-2 focus-visible:outline-primary">
          <X className="size-4" strokeWidth={1.5} />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mb-5 flex flex-col gap-1.5 pr-8", className)} {...props} />;
}
function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />;
}
function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("text-section font-semibold", className)} {...props} />;
}
function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-body text-fg-2", className)} {...props} />;
}

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription };
