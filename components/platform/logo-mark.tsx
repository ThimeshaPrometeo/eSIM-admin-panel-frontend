import { useId } from "react";
import { FULL, logoGeometry, LOGO_VIEWBOX } from "@/lib/brand/logo";
import { cn } from "@/lib/utils";

const G = logoGeometry(FULL);
const N = LOGO_VIEWBOX;

/**
 * The product mark (no company name). The default is the hand-built mark from
 * `lib/brand/logo.ts`, drawn inline (nothing is fetched) on a transparent
 * background: Azure → Emerald on dark, Midnight Ink on light (the `--logo-from`
 * / `--logo-to` tokens follow the nearest data-theme).
 *
 * White-label: a tenant's own mark replaces it through `src` (from tenant
 * settings when the backend provides one); the default stays the fallback.
 */
export function LogoMark({ className, title = "eSIM platform", src }: { className?: string; title?: string; src?: string | null }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  if (src)
    return (
      // a tenant's uploaded image (any size or format): a plain <img>, not next/image
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={title} className={cn("inline-block size-8 shrink-0 object-contain", className)} />
    );
  return (
    <svg
      role="img"
      aria-label={title}
      viewBox={`0 0 ${N} ${N}`}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("inline-block size-8 shrink-0", className)}
    >
      <defs>
        <linearGradient id={`${id}g`} x1={G.gradient.x1} y1={G.gradient.y1} x2={G.gradient.x2} y2={G.gradient.y2} gradientUnits="userSpaceOnUse">
          <stop style={{ stopColor: "var(--logo-from)" }} />
          <stop offset="1" style={{ stopColor: "var(--logo-to)" }} />
        </linearGradient>
        {/* the orbit's near half passes in front: a gap in the card and chip where it crosses */}
        <mask id={`${id}n`} maskUnits="userSpaceOnUse" x="0" y="0" width={N} height={N}>
          <rect width={N} height={N} fill="#fff" />
          <path d={G.orbitNear} stroke="#000" strokeWidth={G.cut} />
        </mask>
        {/* its far half passes behind the card */}
        <mask id={`${id}f`} maskUnits="userSpaceOnUse" x="0" y="0" width={N} height={N}>
          <rect width={N} height={N} fill="#fff" />
          <path d={G.card} fill="#000" stroke="#000" strokeWidth={G.cut} />
        </mask>
      </defs>
      <g stroke={`url(#${id}g)`} strokeWidth={G.stroke}>
        <g mask={`url(#${id}n)`}>
          <path d={G.card} />
          {G.chip.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <path d={G.orbitFar} mask={`url(#${id}f)`} />
        <path d={G.orbitNear} />
      </g>
    </svg>
  );
}
