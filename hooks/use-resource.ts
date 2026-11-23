"use client";

import { useEffect, useState } from "react";
import { usePlatform } from "@/contexts/platform-context";
import type { ApiError } from "@/lib/api/errors";

/**
 * Loads data for a view and reloads it when `deps` change or the data
 * changes anywhere (`dataVersion`). Keeps the previous data while
 * reloading, so a refresh after an action doesn't flash skeletons.
 */
export function useResource<T>(load: () => Promise<T>, deps: readonly unknown[], enabled = true) {
  const { dataVersion } = usePlatform();
  const key = JSON.stringify(deps);
  const [state, setState] = useState<{ key: string | null; version: number; data: T | undefined; error: ApiError | null }>({
    key: null,
    version: -1,
    data: undefined,
    error: null,
  });

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    load().then(
      (data) => alive && setState({ key, version: dataVersion, data, error: null }),
      (error: ApiError) => alive && setState((s) => ({ key, version: dataVersion, data: s.key === key ? s.data : undefined, error })),
    );
    return () => {
      alive = false;
    };
    // `load` is a new function every render; `key` stands for what it depends on
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, dataVersion, enabled]);

  const current = state.key === key;
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : null,
    /** First load for these inputs (no data yet). */
    loading: enabled && (!current || (state.data === undefined && !state.error)),
    /** Reloading after a change, with the previous data still shown. */
    refreshing: enabled && current && state.version !== dataVersion,
  };
}
