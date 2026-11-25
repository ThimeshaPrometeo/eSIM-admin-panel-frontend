import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BRAND, logoSvg, SIMPLE } from "./logo";

const read = (p: string) => readFileSync(p, "utf8");

describe("brand mark", () => {
  it("committed SVGs match the geometry (run pnpm build:logo after changing it)", () => {
    expect(read("public/brand/logo-mark.svg")).toBe(logoSvg() + "\n");
    expect(read("public/brand/logo-mark-white.svg")).toBe(logoSvg({ paint: BRAND.white }) + "\n");
    expect(read("public/brand/logo-mark-ink.svg")).toBe(logoSvg({ paint: BRAND.ink }) + "\n");
    expect(read("app/icon.svg")).toBe(logoSvg({ variant: SIMPLE, tile: { fill: BRAND.ink, radius: 14 }, scale: 0.86 }) + "\n");
  });

  it("is hand-built vector only: no embedded bitmap, no external reference", () => {
    for (const f of ["logo-mark", "logo-mark-white", "logo-mark-ink", "favicon", "app-icon"]) {
      const svg = read(`public/brand/${f}.svg`);
      expect(svg).not.toMatch(/<image|data:|href=|@import/);
      expect(svg.replace('xmlns="http://www.w3.org/2000/svg"', "")).not.toMatch(/https?:/);
    }
  });

  it("uses the brand colours and one stroke weight", () => {
    const svg = logoSvg();
    expect(svg).toContain(BRAND.azure);
    expect(svg).toContain(BRAND.emerald);
    expect(new Set(svg.match(/stroke-width="[\d.]+"/g)).size).toBe(2); // the line weight, and the gap cut around the orbit
  });

  it("favicon.ico holds 16, 32 and 48 px PNG images", () => {
    const ico = readFileSync("app/favicon.ico");
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(3);
    expect([0, 1, 2].map((i) => ico.readUInt8(6 + 16 * i))).toEqual([16, 32, 48]);
    const first = ico.readUInt32LE(6 + 12);
    expect(ico.subarray(first + 1, first + 4).toString()).toBe("PNG");
  });
});
