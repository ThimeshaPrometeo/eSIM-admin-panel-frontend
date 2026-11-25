/**
 * The desktop section column (spec 5.4): collapsed or expanded, remembered
 * per user in this browser, and the signal that tells charts the content
 * area is being resized by its width animation.
 */

/** Below this viewport width the column starts collapsed, unless the user expanded it before. */
export const NAV_WIDE_VIEWPORT = 1440;
export const SECTION_COLUMN_WIDTH = 232;
/** The column's width animation (ms); same weighted easing as the rest of the app. */
export const NAV_TRANSITION_MS = 300;

const key = (userId: string) => `esim-nav-column:${userId}`;

/** The saved choice, or null when the user never toggled it (or storage is blocked). */
export function readNavCollapsed(userId: string): boolean | null {
  try {
    const v = localStorage.getItem(key(userId));
    return v === "collapsed" ? true : v === "expanded" ? false : null;
  } catch {
    return null;
  }
}

export function writeNavCollapsed(userId: string, collapsed: boolean) {
  try {
    localStorage.setItem(key(userId), collapsed ? "collapsed" : "expanded");
  } catch {
    /* storage blocked: the choice lasts until the page reloads */
  }
}

/** Where the column starts: the saved choice, else collapsed on narrower screens. */
export function initialNavCollapsed(saved: boolean | null, viewportWidth: number) {
  return saved ?? viewportWidth < NAV_WIDE_VIEWPORT;
}

// ------------------------------------------------- resize signal for charts

/** Set on <html> while the column animates; charts hold their size until it ends. */
export const NAV_RESIZING_ATTR = "data-nav-resizing";
/** Fired on window when the animation ends: charts measure once, at the final size. */
export const NAV_RESIZED_EVENT = "nav:resized";

export function isNavResizing() {
  return typeof document !== "undefined" && document.documentElement.hasAttribute(NAV_RESIZING_ATTR);
}

export function startNavResize() {
  document.documentElement.setAttribute(NAV_RESIZING_ATTR, "");
}

export function endNavResize() {
  if (!document.documentElement.hasAttribute(NAV_RESIZING_ATTR)) return;
  document.documentElement.removeAttribute(NAV_RESIZING_ATTR);
  window.dispatchEvent(new Event(NAV_RESIZED_EVENT));
}

/** The "[" shortcut, ignored while typing or with a modifier. */
export function isNavToggleKey(e: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "target">) {
  if (e.key !== "[" || e.metaKey || e.ctrlKey || e.altKey) return false;
  const t = e.target as HTMLElement | null;
  if (!t || typeof t.closest !== "function") return true;
  return !t.closest("input, textarea, select, [contenteditable=''], [contenteditable='true'], [role='combobox'], [role='textbox']");
}
