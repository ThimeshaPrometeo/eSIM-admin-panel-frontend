"use client";

import { Toaster as Sonner } from "sonner";

/** Glass toasts. A button and its toast use the same verb (spec 7.8). */
function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      gap={10}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "glass-pop flex w-[356px] items-start gap-3 rounded-[14px] px-4 py-3.5 text-body text-fg",
          title: "font-medium",
          description: "text-small text-fg-2",
          icon: "mt-0.5 [&_svg]:size-4",
          success: "[&_[data-icon]]:text-accent",
          error: "[&_[data-icon]]:text-danger",
          warning: "[&_[data-icon]]:text-warning",
          info: "[&_[data-icon]]:text-primary",
          actionButton: "ml-auto rounded-full bg-surface-3 px-3 py-1 text-small font-medium",
        },
      }}
    />
  );
}

export { Toaster };
