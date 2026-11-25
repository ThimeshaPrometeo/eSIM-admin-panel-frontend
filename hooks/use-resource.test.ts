import { describe, expect, it } from "vitest";
import { shareUnchanged } from "./use-resource";

describe("shareUnchanged (quiet background refresh)", () => {
  const prev = { generatedAt: "t1", series: [{ b: "d1", v: 1 }, { b: "d2", v: 2 }], kpis: { revenue: { value: 10 } }, live: [{ id: "a" }] };

  it("keeps every unchanged part identical, even when the answer is a new object", () => {
    const next = JSON.parse(JSON.stringify({ ...prev, generatedAt: "t2" }));
    const out = shareUnchanged(prev, next);
    expect(out).not.toBe(prev); // generatedAt changed
    expect(out.generatedAt).toBe("t2");
    expect(out.series).toBe(prev.series);
    expect(out.kpis).toBe(prev.kpis);
    expect(out.live).toBe(prev.live);
  });

  it("returns the previous object when nothing changed", () => {
    expect(shareUnchanged(prev, JSON.parse(JSON.stringify(prev)))).toBe(prev);
  });

  it("replaces only what changed", () => {
    const next = JSON.parse(JSON.stringify(prev));
    next.series[1].v = 3;
    const out = shareUnchanged(prev, next);
    expect(out.series).not.toBe(prev.series);
    expect(out.series[0]).toBe(prev.series[0]);
    expect(out.series[1]).toEqual({ b: "d2", v: 3 });
    expect(out.kpis).toBe(prev.kpis);
  });

  it("handles added and removed items", () => {
    const next = JSON.parse(JSON.stringify(prev));
    next.live.unshift({ id: "b" });
    const out = shareUnchanged(prev, next);
    expect(out.live.map((x: { id: string }) => x.id)).toEqual(["b", "a"]);
    expect(out.series).toBe(prev.series);
  });
});
