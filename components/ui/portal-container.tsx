"use client";

import { createContext, useContext } from "react";

/**
 * Where Radix portals (dialogs, menus, selects, tooltips) mount. Default: the
 * document body. A themed region (e.g. the light pane of the design-system
 * page) can provide its own element so floating layers inherit its theme.
 */
export const PortalContainerContext = createContext<HTMLElement | null>(null);
export function usePortalContainer() {
  return useContext(PortalContainerContext) ?? undefined;
}
