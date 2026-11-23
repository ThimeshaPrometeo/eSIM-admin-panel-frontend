/**
 * The in-memory demo store (spec 4.1), persisted to localStorage so a demo
 * survives a refresh. Every demo API call reads and writes it; `commit()`
 * saves and tells subscribers (the app refetches). "Reset demo data" reseeds
 * and keeps the signed-in role.
 */
import { SCHEMA_VERSION, type DState } from "./model";
import { createSeed } from "./seed";

const KEY = `esim-demo:v${SCHEMA_VERSION}`;
let state: DState | null = null;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function load(): DState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DState;
    return parsed.schema === SCHEMA_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

function save() {
  if (typeof window === "undefined" || !state) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked: the demo keeps working for this visit */
  }
}

export function db(): DState {
  if (!state) {
    state = load() ?? createSeed();
    // drop older versions of the store
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k?.startsWith("esim-demo:") && k !== KEY) window.localStorage.removeItem(k);
      }
    } catch {
      /* ignore */
    }
  }
  return state;
}

/** Save (debounced) and notify subscribers after a change. */
export function commit() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 120);
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetDemoData() {
  const keep = db().session;
  state = createSeed();
  state.session = { ...keep, pendingMfaUserId: null };
  save();
  listeners.forEach((l) => l());
}

export function nextId(prefix: string) {
  const s = db();
  s.seq += 1;
  return `${prefix}${s.seq}`;
}

/** Tests can replace the store and turn latency off. */
export function __setState(next: DState | null) {
  state = next;
}
let latencyOn = true;
export function __setLatency(on: boolean) {
  latencyOn = on;
}

/** Small random delay (150–600 ms) so loading states are visible (spec 4.1). */
export function latency(): Promise<void> {
  if (!latencyOn) return Promise.resolve();
  return new Promise((r) => setTimeout(r, 150 + Math.random() * 450));
}
