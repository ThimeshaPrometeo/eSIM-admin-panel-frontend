import { afterEach, describe, expect, it } from "vitest";
import { endNavResize, initialNavCollapsed, isNavResizing, isNavToggleKey, NAV_RESIZED_EVENT, readNavCollapsed, startNavResize, writeNavCollapsed } from "./nav-layout";

afterEach(() => localStorage.clear());

const key = (k: string, target: HTMLElement = document.body, mods: Partial<Record<"metaKey" | "ctrlKey" | "altKey", boolean>> = {}) => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  ...mods,
  target,
});

describe("section column preference", () => {
  it("starts collapsed below 1440px and expanded from 1440px, unless the user chose", () => {
    expect(initialNavCollapsed(null, 1366)).toBe(true);
    expect(initialNavCollapsed(null, 1439)).toBe(true);
    expect(initialNavCollapsed(null, 1440)).toBe(false);
    expect(initialNavCollapsed(false, 1366)).toBe(false); // expanded before: stays expanded
    expect(initialNavCollapsed(true, 1920)).toBe(true);
  });

  it("is remembered per user", () => {
    expect(readNavCollapsed("u1")).toBeNull();
    writeNavCollapsed("u1", true);
    writeNavCollapsed("u2", false);
    expect(readNavCollapsed("u1")).toBe(true);
    expect(readNavCollapsed("u2")).toBe(false);
  });
});

describe("the [ shortcut", () => {
  it("toggles from the page, not while typing or with a modifier", () => {
    expect(isNavToggleKey(key("["))).toBe(true);
    expect(isNavToggleKey(key("]"))).toBe(false);
    expect(isNavToggleKey(key("[", document.body, { metaKey: true }))).toBe(false);
    const input = document.createElement("input");
    document.body.append(input);
    expect(isNavToggleKey(key("[", input))).toBe(false);
    const box = document.createElement("div");
    box.setAttribute("role", "combobox");
    document.body.append(box);
    expect(isNavToggleKey(key("[", box))).toBe(false);
  });
});

describe("resize signal", () => {
  it("marks the animation and tells charts once it ends", () => {
    let fired = 0;
    const on = () => fired++;
    window.addEventListener(NAV_RESIZED_EVENT, on);
    startNavResize();
    expect(isNavResizing()).toBe(true);
    endNavResize();
    endNavResize(); // a second end (safety timeout) doesn't fire again
    expect(isNavResizing()).toBe(false);
    expect(fired).toBe(1);
    window.removeEventListener(NAV_RESIZED_EVENT, on);
  });
});
