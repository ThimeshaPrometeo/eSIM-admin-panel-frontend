/** Motion tokens (spec 7.6). Mirrors the CSS custom properties in globals.css. */
export const EASE_OUT_EXPO = [0.22, 1, 0.36, 1] as const;
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;
export const EASE_OUT_EXPO_CSS = "cubic-bezier(0.22, 1, 0.36, 1)";
export const EASE_IN_OUT_CSS = "cubic-bezier(0.65, 0, 0.35, 1)";

export const DURATION = { hover: 180, reveal: 600, layout: 500, countUp: 900 } as const;
export const REVEAL = { rise: 14, stagger: 60 } as const;

/** Cubic-bezier evaluator, for rAF animations that must match the CSS easing. */
export function bezier([x1, y1, x2, y2]: readonly [number, number, number, number]) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dsx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const d = dsx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= (sx(t) - x) / d;
    }
    return sy(Math.min(1, Math.max(0, t)));
  };
}

export const easeOutExpo = bezier(EASE_OUT_EXPO);
export const easeInOut = bezier(EASE_IN_OUT);

/** Frame-rate independent lerp factor: `smoothing` = fraction left after 1 s. */
export function damp(current: number, target: number, smoothing: number, dtSeconds: number) {
  return target + (current - target) * Math.pow(smoothing, dtSeconds);
}
