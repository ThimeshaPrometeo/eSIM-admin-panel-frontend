"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { usePlatform } from "@/contexts/platform-context";
import { errorMessage } from "@/lib/api/errors";

/**
 * Runs a mutation: shows a toast with the same verb as the button on
 * success, the error in plain words on failure, and refreshes the data.
 */
export function useAction() {
  const { refresh } = usePlatform();
  const [pending, setPending] = useState(false);
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, opts: { success?: string | ((r: T) => string); description?: string | ((r: T) => string | undefined); silent?: boolean } = {}) => {
      setPending(true);
      try {
        const r = await fn();
        if (opts.success) {
          const msg = typeof opts.success === "function" ? opts.success(r) : opts.success;
          const desc = typeof opts.description === "function" ? opts.description(r) : opts.description;
          toast.success(msg, desc ? { description: desc } : undefined);
        }
        refresh();
        return { ok: true as const, result: r };
      } catch (e) {
        if (!opts.silent) toast.error(errorMessage(e));
        return { ok: false as const, error: e };
      } finally {
        setPending(false);
      }
    },
    [refresh],
  );
  return { run, pending };
}
