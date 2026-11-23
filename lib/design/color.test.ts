import { describe, expect, it } from "vitest";
import { contrast, cssColorToHex, oklchToRgb } from "./color";

describe("oklch conversion", () => {
  it("converts white and black", () => {
    expect(cssColorToHex("oklch(1 0 0)")).toBe("#ffffff");
    expect(cssColorToHex("oklch(0 0 0)")).toBe("#000000");
  });
  it("accepts percentage lightness and alpha", () => {
    expect(cssColorToHex("oklch(100% 0 0 / 0.5)")).toBe("#ffffff");
  });
  it("passes other colour formats through", () => {
    expect(cssColorToHex("#0080ff")).toBe("#0080ff");
    expect(cssColorToHex("rgb(1, 2, 3)")).toBe("rgb(1, 2, 3)");
  });
  it("matches a known oklch value", () => {
    // oklch(0.628 0.2577 29.23) is sRGB red
    const [r, g, b] = oklchToRgb(0.628, 0.2577, 29.23);
    expect(r).toBeCloseTo(1, 1);
    expect(g).toBeCloseTo(0, 1);
    expect(b).toBeCloseTo(0, 1);
  });
  it("computes WCAG contrast", () => {
    expect(contrast("#ffffff", "#000000")).toBeCloseTo(21, 0);
  });
});
