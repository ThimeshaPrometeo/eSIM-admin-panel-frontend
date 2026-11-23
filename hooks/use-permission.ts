"use client";

import { usePlatform } from "@/contexts/platform-context";
import { can as canModule, canAny, rules } from "@/lib/platform/permissions";
import type { Level } from "@/lib/platform/permission-matrix";
import type { Module } from "@/lib/platform/types";

/** Display-only permission checks for the signed-in user (the backend decides). */
export function usePermission() {
  const { me } = usePlatform();
  return {
    me,
    can: (module: Module, level: Level = "view") => canModule(me?.permissions, module, level),
    canAny: (modules: Module[], level: Level = "view") => canAny(me?.permissions, modules, level),
    rules,
    isTenant: rules.isTenantUser(me),
  };
}
