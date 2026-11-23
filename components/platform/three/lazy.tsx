"use client";

/**
 * The only entry point pages use for 3D (CONVENTIONS §9.4). The heavy modules
 * (three, R3F, drei, gsap, globe geometry) are dynamic imports, client only,
 * so they are not in any page bundle and are never loaded when the device
 * gets the static fallback.
 */
import dynamic from "next/dynamic";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { useGraphicsTier } from "./use-graphics-tier";
import { useClosestTheme } from "./use-closest-theme";
import type { GlobeProps } from "./globe";

const GlobeCanvas = dynamic(() => import("./globe"), { ssr: false, loading: () => null });
const ShaderCanvas = dynamic(() => import("./shader-background"), { ssr: false, loading: () => null });

/** Static globe (pre-rendered SVG) for no WebGL, low-power devices and while loading. */
export function GlobeFallback({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const theme = useClosestTheme(ref);
  return (
    <div ref={ref} className={cn("grid h-full w-full place-items-center", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={theme === "light" ? "/globe-fallback-light.svg" : "/globe-fallback-dark.svg"}
        alt="Globe with covered countries highlighted"
        className="aspect-square h-auto max-h-full w-auto max-w-full"
        decoding="async"
      />
    </div>
  );
}

export function LiveGlobe({ className, ...props }: GlobeProps) {
  const tier = useGraphicsTier();
  return (
    <div className={cn("relative h-full w-full", className)} data-graphics={tier}>
      {tier === "webgl" ? <GlobeCanvas {...props} /> : <GlobeFallback />}
    </div>
  );
}

/** CSS gradient used instead of the shader (no WebGL, low power) and before it loads. */
export function ShaderFallback({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("absolute inset-0", className)}
      style={{
        background:
          "radial-gradient(60% 70% at 18% 10%, color-mix(in oklab, var(--primary) 30%, transparent), transparent 70%), radial-gradient(55% 60% at 85% 95%, color-mix(in oklab, var(--accent) 18%, transparent), transparent 70%), var(--bg)",
      }}
    />
  );
}

export function LiveShaderBackground({ className }: { className?: string }) {
  const tier = useGraphicsTier();
  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)} data-graphics={tier}>
      <ShaderFallback />
      {tier === "webgl" ? <ShaderCanvas /> : null}
    </div>
  );
}
