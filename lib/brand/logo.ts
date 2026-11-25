/*
 * The default product mark: a SIM card with a globe chip, circled by an orbit.
 * Hand-built on a 64-unit grid (no traced bitmap), one stroke weight, round
 * caps and joins. The orbit's near half passes in front (the card and chip
 * open a gap where it crosses); its far half passes behind the card (hidden
 * inside it). One source for the React mark (`components/platform/logo-mark.tsx`)
 * and the generated files (`pnpm build:logo` → public/brand, app/icon.svg,
 * app/favicon.ico, app/apple-icon.png).
 *
 * Tenants can replace the mark (white-label): `LogoMark` takes their image.
 */

export const LOGO_VIEWBOX = 64;

export const BRAND = {
  azure: "#0080FF",
  emerald: "#00E5A0",
  ink: "#050A14", // Midnight Ink
  white: "#FFFFFF",
} as const;

/** The SIM card: a rounded rectangle with its top-right corner cut at 45°. */
export type Card = { x: number; y: number; w: number; h: number; r: number; cut: number };
function cardPath({ x, y, w, h, r, cut }: Card) {
  const [R, B] = [x + w, y + h];
  return `M${x + r} ${y}H${R - cut}L${R} ${y + cut}V${B - r}A${r} ${r} 0 0 1 ${R - r} ${B}H${x + r}A${r} ${r} 0 0 1 ${x} ${B - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}
/** The chip, drawn as a globe: rounded outline, two meridians, the equator. */
const CHIP = [
  "M25.5 24H38.5A5.5 5.5 0 0 1 44 29.5V43A5.5 5.5 0 0 1 38.5 48.5H25.5A5.5 5.5 0 0 1 20 43V29.5A5.5 5.5 0 0 1 25.5 24Z",
  "M28.5 24C24.5 29.5 24.5 43 28.5 48.5",
  "M35.5 24C39.5 29.5 39.5 43 35.5 48.5",
  "M20 36.25H44",
];
/** An orbit tilted −30°, split at its two ends into the far half (over the top) and the near half. */
export type Orbit = { cx: number; cy: number; rx: number; ry: number };
const TILT = -30;
const r2 = (n: number) => Math.round(n * 100) / 100;
function orbitPaths({ cx, cy, rx, ry }: Orbit) {
  const a = (TILT * Math.PI) / 180;
  const [dx, dy] = [r2(rx * Math.cos(a)), r2(rx * Math.sin(a))];
  const left = `${r2(cx - dx)} ${r2(cy - dy)}`;
  const right = `${r2(cx + dx)} ${r2(cy + dy)}`;
  const arc = `A${rx} ${ry} ${TILT} 0 1`;
  return { far: `M${left}${arc} ${right}`, near: `M${right}${arc} ${left}` };
}

export type LogoVariant = {
  /** Full mark (UI, 24 px and up) or simplified (favicon: card and orbit only, heavier). */
  detail: "full" | "simple";
  stroke: number;
  /** Clear space either side of the orbit where it crosses a line. */
  gap: number;
  card: Card;
  orbit: Orbit;
};
export const FULL: LogoVariant = { detail: "full", stroke: 2.75, gap: 2, card: { x: 15, y: 9, w: 34, h: 46, r: 3.5, cut: 10 }, orbit: { cx: 32, cy: 30, rx: 31, ry: 7.5 } };
/** Favicon: no chip, heavier stroke, a narrower card and a rounder orbit, so it still reads as a card in a ring at 16 px. */
export const SIMPLE: LogoVariant = { detail: "simple", stroke: 5.5, gap: 3, card: { x: 20, y: 10, w: 24, h: 44, r: 3, cut: 8 }, orbit: { cx: 32, cy: 32, rx: 30, ry: 12 } };

export function logoGeometry(v: LogoVariant = FULL) {
  const orbit = orbitPaths(v.orbit);
  return {
    card: cardPath(v.card),
    chip: v.detail === "full" ? CHIP : [],
    orbitFar: orbit.far,
    orbitNear: orbit.near,
    stroke: v.stroke,
    /** Width of the cut made around the orbit's near half / around the card for the far half. */
    cut: v.stroke + 2 * v.gap,
    /** Gradient axis, bottom-left (Azure) to top-right (Emerald). */
    gradient: { x1: 6, y1: 52, x2: 58, y2: 10 },
  };
}

export type LogoPaint = "gradient" | string;

/**
 * The mark as a standalone SVG string. `tile` puts it on a rounded square
 * (app icons, favicon) at `scale` of the tile.
 */
export function logoSvg({
  paint = "gradient",
  variant = FULL,
  size,
  tile,
  scale = 0.74,
  id = "m",
}: {
  paint?: LogoPaint;
  variant?: LogoVariant;
  size?: number;
  tile?: { fill: string; radius: number };
  scale?: number;
  id?: string;
} = {}): string {
  const g = logoGeometry(variant);
  const n = LOGO_VIEWBOX;
  const stroke = paint === "gradient" ? `url(#${id}g)` : paint;
  const grad =
    paint === "gradient"
      ? `<linearGradient id="${id}g" x1="${g.gradient.x1}" y1="${g.gradient.y1}" x2="${g.gradient.x2}" y2="${g.gradient.y2}" gradientUnits="userSpaceOnUse"><stop stop-color="${BRAND.azure}"/><stop offset="1" stop-color="${BRAND.emerald}"/></linearGradient>`
      : "";
  const mask = (name: string, body: string) =>
    `<mask id="${id}${name}" maskUnits="userSpaceOnUse" x="0" y="0" width="${n}" height="${n}"><rect width="${n}" height="${n}" fill="#fff"/>${body}</mask>`;
  const mark = [
    `<g stroke="${stroke}" stroke-width="${g.stroke}">`,
    `<g mask="url(#${id}n)"><path d="${g.card}"/>${g.chip.map((d) => `<path d="${d}"/>`).join("")}</g>`,
    `<path d="${g.orbitFar}" mask="url(#${id}f)"/>`,
    `<path d="${g.orbitNear}"/>`,
    `</g>`,
  ].join("");
  const placed = tile ? `<g transform="translate(${n / 2} ${n / 2}) scale(${scale}) translate(${-n / 2} ${-n / 2})">${mark}</g>` : mark;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}"${size ? ` width="${size}" height="${size}"` : ""} fill="none" stroke-linecap="round" stroke-linejoin="round">`,
    `<defs>${grad}`,
    mask("n", `<path d="${g.orbitNear}" stroke="#000" stroke-width="${g.cut}"/>`),
    mask("f", `<path d="${g.card}" fill="#000" stroke="#000" stroke-width="${g.cut}"/>`),
    `</defs>`,
    tile ? `<rect width="${n}" height="${n}" rx="${tile.radius}" fill="${tile.fill}"/>` : "",
    placed,
    `</svg>`,
  ].join("");
}
