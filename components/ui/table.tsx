import * as React from "react";
import { cn } from "@/lib/utils";

/** Tables (spec 7.8): comfortable rows, sticky glass header, --surface-3 row hover. */
function Table({ className, containerClassName, ...props }: React.ComponentProps<"table"> & { containerClassName?: string }) {
  return (
    <div className={cn("relative w-full overflow-auto", containerClassName)}>
      <table className={cn("w-full caption-bottom border-separate border-spacing-0 text-body", className)} {...props} />
    </div>
  );
}
function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("[&_th]:sticky [&_th]:top-0 [&_th]:z-10", className)} {...props} />;
}
function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={cn("[&_tr:last-child_td]:border-0", className)} {...props} />;
}
function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr className={cn("group transition-colors duration-[180ms] hover:[&>td]:bg-surface-3/55 data-[state=selected]:[&>td]:bg-surface-3", className)} {...props} />;
}
function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "glass-pop !rounded-none !border-x-0 !border-t-0 !shadow-none h-11 whitespace-nowrap px-3 text-left first:pl-4 last:pr-4 align-middle text-small font-medium text-fg-2 first:rounded-tl-card last:rounded-tr-card",
        className,
      )}
      {...props}
    />
  );
}
function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("h-14 whitespace-nowrap border-b border-border px-3 align-middle first:pl-4 last:pr-4", className)} {...props} />;
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
