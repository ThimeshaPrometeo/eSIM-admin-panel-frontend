"use client";

import { useEffect, useState } from "react";
import { usePlatform } from "@/contexts/platform-context";
import type { ApiError } from "@/lib/api/errors";

/**
 * Returns `next`, reusing every part of `prev` that is unchanged (deep), so
 * components that depend on an unchanged part keep the same object and don't
 * redraw after a background refresh.
 */
export function shareUnchanged<T>(prev: T, next: T): T {
  if (prev === next) return prev;
  if (typeof prev !== "object" || typeof next !== "object" || prev === null || next === null) return next;
  if (Array.isArray(prev) !== Array.isArray(next)) return next;
  if (Array.isArray(prev) && Array.isArray(next)) {
    const out = next.map((v, i) => (i < prev.length ? shareUnchanged(prev[i], v) : v));
    return (out.length === prev.length && out.every((v, i) => v === prev[i]) ? prev : out) as T;
  }
  const p = prev as Record<string, unknown>;
  const n = next as Record<string, unknown>;
  const keys = Object.keys(n);
  const out: Record<string, unknown> = {};
  let same = keys.length === Object.keys(p).length;
  for (const k of keys) {
    out[k] = k in p ? shareUnchanged(p[k], n[k]) : n[k];
    if (out[k] !== p[k]) same = false;
  }
  return (same ? prev : out) as T;
}

/**
 * Loads data for a view and reloads it when `deps` change or the data
 * changes anywhere (`dataVersion`). Keeps the previous data while
 * reloading, so a refresh after an action doesn't flash skeletons.
 *
 * `pollMs` refreshes quietly in the background while the tab is visible: the
 * data on screen stays until the new answer arrives, and unchanged parts keep
 * their identity (nothing redraws unless it changed).
 *
 * `keepPrevious` keeps showing the last answer while new inputs load (a filter
 * change), flagged `stale`, instead of going back to skeletons.
 */
export function useResource<T>(load: () => Promise<T>, deps: readonly unknown[], enabled = true, opts: { pollMs?: number; keepPrevious?: boolean } = {}) {
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
      (data) => alive && setState((s) => ({ key, version: dataVersion, data: s.key === key && s.data !== undefined ? shareUnchanged(s.data, data) : data, error: null })),
      (error: ApiError) => alive && setState((s) => ({ key, version: dataVersion, data: s.key === key ? s.data : undefined, error })),
    );
    return () => {
      alive = false;
    };
    // `load` is a new function every render; `key` stands for what it depends on
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, dataVersion, enabled]);

  // quiet background refresh: same key, the current data stays on screen; errors are ignored (the next poll retries)
  const pollMs = opts.pollMs;
  useEffect(() => {
    if (!enabled || !pollMs) return;
    let alive = true;
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      load().then(
        (data) =>
          alive &&
          setState((s) => {
            if (s.key !== key || s.data === undefined) return s;
            const shared = shareUnchanged(s.data, data);
            return shared === s.data ? s : { ...s, data: shared };
          }),
        () => undefined,
      );
    }, pollMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, pollMs]);

  const current = state.key === key;
  const keep = !current && !!opts.keepPrevious && state.data !== undefined;
  return {
    data: current || keep ? state.data : undefined,
    error: current ? state.error : null,
    /** Showing the previous inputs' answer while the new one loads (`keepPrevious`). */
    stale: keep,
    /** First load for these inputs (no data yet). */
    loading: enabled && !keep && (!current || (state.data === undefined && !state.error)),
    /** Reloading after a change, with the previous data still shown. */
    refreshing: enabled && current && state.version !== dataVersion,
  };
}
