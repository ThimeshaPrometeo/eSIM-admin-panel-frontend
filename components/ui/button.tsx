"use client";

import * as React from "react";
import { Slot } from "radix-ui";
import { ArrowRight } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useCursorGlow } from "@/components/platform/motion/use-cursor-glow";

/**
 * Buttons (Phase 1 review). Styles live in globals.css (.btn-*):
 * - primary: Azure gradient #1A8FFF → #0070E6, 1px top highlight, 1px light
 *   border, soft outer glow fading in on hover, a light that follows the
 *   cursor, press 0.98 in 120 ms, 2px Azure focus ring with a soft glow;
 * - secondary: glass with a 10% border rising to 18% on hover;
 * - ghost, outline, destructive (only for destructive actions), link.
 * Sizes: sm 36, md 44, lg 52; icon 44 / 36.
 */
const buttonVariants = cva("btn", {
  variants: {
    variant: {
      primary: "btn-primary btn-light",
      secondary: "btn-secondary btn-light",
      outline: "btn-outline",
      ghost: "btn-ghost",
      destructive: "btn-destructive btn-light",
      link: "btn-link",
    },
    size: {
      sm: "btn-sm",
      md: "btn-md",
      lg: "btn-lg",
      icon: "btn-icon",
      "icon-sm": "btn-icon-sm",
    },
  },
  defaultVariants: { variant: "primary", size: "md" },
});

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Trailing arrow that slides 2px right on hover. */
    arrow?: boolean;
  };

function Button({ className, variant, size, asChild = false, arrow, children, onPointerMove, onPointerLeave, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  const glow = useCursorGlow<HTMLButtonElement>();
  const lit = !variant || variant === "primary" || variant === "secondary" || variant === "destructive";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size: variant === "link" ? undefined : size }), className)}
      onPointerMove={(e: React.PointerEvent<HTMLButtonElement>) => {
        if (lit) glow.onPointerMove(e);
        onPointerMove?.(e);
      }}
      onPointerLeave={(e: React.PointerEvent<HTMLButtonElement>) => {
        if (lit) glow.onPointerLeave(e);
        onPointerLeave?.(e);
      }}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {children}
          {arrow ? <ArrowRight className="btn-arrow" strokeWidth={1.75} aria-hidden="true" /> : null}
        </>
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
