import Image from "next/image";
import { cn } from "@/lib/utils";
import logo from "@/app/icon.jpg";

/**
 * The product mark (no company name: the brand name and logo come from
 * tenant settings later, white-label). One image for the whole app: the same
 * JPG as the browser icon (`app/icon.jpg`), so there is a single file to
 * replace. The mark sits in the middle of a dark square, so it is shown in a
 * rounded tile and scaled up to fill it; Next.js serves a small resized copy.
 */
export function LogoMark({ className, title = "eSIM platform" }: { className?: string; title?: string }) {
  return (
    <span role="img" aria-label={title} className={cn("relative inline-block size-8 shrink-0 overflow-hidden rounded-[28%] bg-[#070b12]", className)}>
      <Image src={logo} alt="" fill sizes="72px" className="scale-[1.6] object-cover" priority />
    </span>
  );
}
