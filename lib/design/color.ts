/**
 * Colour helpers for canvas/WebGL, which can't read CSS colour functions.
 * Design tokens may be authored in oklch (sign-in palette); these convert them
 * to sRGB.
 */

/** oklch(L C H) → sRGB channels 0..1 (gamut-clipped). L 0..1, C ~0..0.4, H degrees. */
export function oklchToRgb(l: number, c: number, h: number): [number, number, number] {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;
  const lin = [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];
  const gamma = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
  return lin.map((x) => Math.min(1, Math.max(0, gamma(Math.min(1, Math.max(0, x)))))) as [number, number, number];
}

const toHex = (rgb: [number, number, number]) =>
  "#" + rgb.map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("");

/**
 * Turns a computed CSS colour into something three.js understands. Handles
 * oklch(...) (with optional alpha, which is dropped); anything else passes through.
 */
export function cssColorToHex(value: string): string {
  const v = value.trim();
  const m = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/\s*[\d.%]+\s*)?\)$/i.exec(v);
  if (!m) return v;
  const l = Number(m[1]) / (m[2] ? 100 : 1);
  return toHex(oklchToRgb(l, Number(m[3]), Number(m[4])));
}

/** WCAG relative luminance of an sRGB hex colour. */
export function luminance(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = c.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}

export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}
