import * as React from "react";
import { cn } from "@/lib/utils";

export const fieldClass =
  "w-full min-w-0 rounded-control border border-border bg-[color-mix(in_oklab,var(--surface-1)_70%,transparent)] px-3.5 text-body text-fg shadow-[inset_0_1px_0_var(--highlight)] outline-none transition-[border-color,box-shadow] duration-[180ms] ease-out-expo placeholder:text-fg-3 hover:border-border-strong focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_var(--primary-glow)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:shadow-[0_0_0_3px_color-mix(in_oklab,var(--danger)_25%,transparent)]";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(fieldClass, "h-10", className)} {...props} />;
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(fieldClass, "min-h-24 py-2.5", className)} {...props} />;
}

export { Input, Textarea };
