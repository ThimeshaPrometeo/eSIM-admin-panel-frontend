"use client";

import { useSyncExternalStore } from "react";

export type GraphicsTier = "pending" | "webgl" | "static";

/**
 * Decides whether live WebGL graphics may run (spec 7.7): WebGL must exist and
 * the device must not be low-power. `?static=1` forces the fallback (used to
 * check the fallbacks and to measure bundles without the 3D code).
 * This file must never import three: the static path loads no 3D code at all.
 */
export function detectGraphicsTier(): Exclude<GraphicsTier, "pending"> {
  if (typeof window === "undefined") return "static";
  const params = new URLSearchParams(window.location.search);
  if (params.get("static") === "1") return "static";
  if (params.get("static") === "0") return "webgl";
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return "static";
  if ((nav.deviceMemory ?? 8) <= 2 || (nav.hardwareConcurrency ?? 8) <= 2) return "static";
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return "static";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    // Software rasterisers can't hold 60 fps.
    if (/swiftshader|llvmpipe|software/i.test(renderer)) return "static";
    return "webgl";
  } catch {
    return "static";
  }
}

let cached: Exclude<GraphicsTier, "pending"> | null = null;

const noSubscribe = () => () => {};

/** "pending" on the server and in the first client render, then the tier. */
export function useGraphicsTier(): GraphicsTier {
  return useSyncExternalStore(
    noSubscribe,
    () => (cached ??= detectGraphicsTier()),
    () => "pending",
  );
}
