import { commit, latency } from "./store";

/** A demo read: waits like a network call, then runs. */
export async function read<T>(fn: () => T): Promise<T> {
  await latency();
  return structuredClone(fn());
}

/** A demo write: waits, runs, then saves and notifies subscribers (only if it succeeded). */
export async function write<T>(fn: () => T): Promise<T> {
  await latency();
  const result = fn();
  commit();
  return structuredClone(result);
}
