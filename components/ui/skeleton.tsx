import { cn } from "@/lib/utils";

/** Skeletons in --surface-2 with a slow shimmer; no centred spinners (spec 7.8). */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div aria-hidden="true" className={cn("skeleton rounded-[8px]", className)} {...props} />;
}

export { Skeleton };
