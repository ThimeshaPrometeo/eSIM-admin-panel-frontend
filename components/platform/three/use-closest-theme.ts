"use client";

import { useSyncExternalStore, type RefObject } from "react";
import { cssColorToHex } from "@/lib/design/color";

export type ThemeName = "dark" | "light";

function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

/** The theme of the nearest [data-theme] ancestor, kept up to date. */
export function useClosestTheme(ref: RefObject<HTMLElement | null>): ThemeName {
  return useSyncExternalStore(
    subscribe,
    () => (ref.current?.closest("[data-theme]")?.getAttribute("data-theme") === "light" ? "light" : "dark"),
    () => "dark",
  );
}

const cache = new Map<string, Record<string, string>>();

let pixel: CanvasRenderingContext2D | null = null;
/**
 * Any CSS colour (oklch, lab, color-mix, …) → #rrggbb, by letting the browser
 * paint it into a 1×1 canvas. The CSS build may rewrite oklch tokens to lab(),
 * so parsing strings is not reliable; the browser's own conversion is.
 */
function resolveColor(value: string): string {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  const fallback = cssColorToHex(value);
  if (/^#[0-9a-f]{6}$/i.test(fallback)) return fallback;
  if (!pixel) pixel = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!pixel) return value;
  pixel.clearRect(0, 0, 1, 1);
  pixel.fillStyle = "#000";
  pixel.fillStyle = value;
  pixel.fillRect(0, 0, 1, 1);
  const [r, g, b] = pixel.getImageData(0, 0, 1, 1).data;
  return "#" + [r!, g!, b!].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/**
 * Resolves design tokens of a theme to concrete colour strings for canvas and
 * WebGL use, through a hidden probe element (cached per theme).
 */
export function themeTokens<T extends string>(theme: ThemeName, names: readonly T[]): Record<T, string> {
  const key = `${theme}:${names.join(",")}`;
  const hit = cache.get(key);
  if (hit) return hit as Record<T, string>;
  const probe = document.createElement("div");
  probe.dataset.theme = theme;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const style = getComputedStyle(probe);
  // oklch tokens (sign-in palette) are converted, since WebGL can't read them
  const out = Object.fromEntries(names.map((n) => [n, resolveColor(style.getPropertyValue(`--${n}`).trim())])) as Record<T, string>;
  probe.remove();
  cache.set(key, out);
  return out;
}
