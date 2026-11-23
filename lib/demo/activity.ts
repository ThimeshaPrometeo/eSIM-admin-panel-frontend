import { isPriced, type Network } from "@/lib/platform/coverage";
import type { ActivityEvent } from "@/lib/platform/activity";

/** Popular travel destinations, tried first so the demo reads naturally. */
const DESTINATIONS = ["IT", "JP", "AE", "ES", "FR", "US", "GB", "TH", "TR", "DE", "GR", "SG", "PT", "AU", "MX", "ID"];
const KINDS = ["installed", "activated", "on5g", "usage"] as const;

/** Small deterministic PRNG so server and browser render the same events. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Demo events for the sign-in globe chips. Only countries with a priced
 * network appear, and "Now on 5G" only where a priced 5G network exists.
 */
export function demoActivityEvents(networks: readonly Network[], count = 12, seed = 7): ActivityEvent[] {
  const priced = networks.filter(isPriced);
  const byIso = new Map<string, { country: string; nr: boolean }>();
  for (const n of priced) {
    const c = byIso.get(n.iso2);
    byIso.set(n.iso2, { country: n.country, nr: (c?.nr ?? false) || n.nr });
  }
  const pool = DESTINATIONS.filter((iso) => byIso.has(iso));
  if (!pool.length) return [];
  const rand = mulberry32(seed);
  const events: ActivityEvent[] = [];
  for (let i = 0; i < count; i++) {
    const iso2 = pool[i % pool.length]!;
    const { country, nr } = byIso.get(iso2)!;
    let kind = KINDS[i % KINDS.length]!;
    if (kind === "on5g" && !nr) kind = "activated";
    const id = `demo-${i}`;
    events.push(
      kind === "usage"
        ? { id, iso2, country, kind, bytesToday: Math.round((0.3 + rand() * 2.4) * 1024 ** 3) }
        : { id, iso2, country, kind },
    );
  }
  return events;
}
