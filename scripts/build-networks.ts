/**
 * Builds the demo catalogue from the reference files.
 *
 *   docs/reference/PriceList.csv            networks and supplier prices
 *   docs/reference/location_zones_list.csv  real zones (TADIG membership)
 *     ->  lib/demo/seed/catalogue.json
 *
 * One row per network (duplicates in the CSV are merged). A blank data price
 * means the network is unavailable (null, never 0). Satellite rows have no
 * country (iso2 "--"). Besides the three real zones, three demo zones are
 * built only from priced networks (marked demoZone). "Europe 30" and "Asia
 * travel" leave out networks above €0.01/MB, as a travel zone would;
 * "Worldwide" keeps the full price spread. Run: pnpm build:networks
 */
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), "utf8");

// Short display names for long country names (compact UI like the globe chips).
const SHORT: Record<string, string> = { AE: "UAE", GB: "UK", US: "USA" };

function parse(line: string): string[] {
  return [...line.matchAll(/("([^"]*)"|[^,]*)(,|$)/g)].map((m) => (m[2] ?? m[1] ?? "").trim());
}

type Network = {
  id: string;
  iso2: string;
  country: string;
  operator: string;
  tadigs: string[];
  mccMnc: string;
  costPerMb: number | null;
  lte: boolean;
  nr: boolean;
  volte: boolean;
};

const seen = new Map<string, Network>();
for (const line of read("docs/reference/PriceList.csv").split("\n").slice(1)) {
  if (!line.trim()) continue;
  const c = parse(line);
  const rawIso = (c[2] ?? "").toUpperCase();
  const iso2 = /^[A-Z]{2}$/.test(rawIso) ? rawIso : "--";
  const operator = (c[3] ?? "").replace(/\s+/g, " ").trim();
  const mccMnc = c[5] ?? "";
  const key = `${iso2}|${operator}|${mccMnc}`;
  if (seen.has(key)) continue;
  const raw = c[6] ?? "";
  const price = Number(raw);
  seen.set(key, {
    id: `n${seen.size + 1}`,
    iso2,
    country: iso2 === "--" ? "Satellite networks" : (SHORT[iso2] ?? c[0] ?? iso2),
    operator,
    tadigs: (c[4] ?? "").split(",").map((t) => t.trim()).filter(Boolean),
    mccMnc,
    costPerMb: raw !== "" && Number.isFinite(price) && price > 0 ? price : null,
    lte: c[10] === "true",
    nr: c[11] === "true",
    volte: c[12] === "true",
  });
}
const networks = [...seen.values()];
const byTadig = new Map<string, Network>();
for (const n of networks) for (const t of n.tadigs) byTadig.set(t, n);

// Real zones: membership by TADIG.
const real = new Map<string, { id: string; name: string; ids: Set<string>; missing: string[] }>();
for (const line of read("docs/reference/location_zones_list.csv").split("\n").slice(1)) {
  if (!line.trim()) continue;
  const c = parse(line);
  const lzId = c[0]!;
  const name = c[4] === "TEST_LZ" || c[4] === "ENIGMA_LZ" ? c[4] : c[1] === "Italy" && lzId === "79313" ? "Italy" : (c[4] ?? lzId);
  const z = real.get(lzId) ?? { id: `lz${lzId}`, name, ids: new Set<string>(), missing: [] };
  const n = byTadig.get(c[3] ?? "");
  if (n) z.ids.add(n.id);
  else z.missing.push(c[3] ?? "");
  real.set(lzId, z);
}

const EUROPE = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "GB", "CH", "NO"];
const ASIA = ["LK", "IN", "MV", "TH", "MY", "SG", "ID", "VN", "JP", "KR", "AE", "HK"];
const priced = (n: Network) => n.costPerMb !== null;
const demo = (id: string, name: string, pick: (n: Network) => boolean) => ({
  id,
  name,
  source: "demo" as const,
  demoZone: true,
  networkIds: networks.filter((n) => priced(n) && pick(n)).map((n) => n.id),
  missingTadigs: [] as string[],
});

const zones = [
  ...[...real.values()].map((z) => ({
    id: z.id,
    name: z.name,
    source: "supplier" as const,
    demoZone: false,
    networkIds: [...z.ids],
    missingTadigs: z.missing,
  })),
  demo("z-europe30", "Europe 30", (n) => EUROPE.includes(n.iso2) && (n.costPerMb ?? 1) <= 0.01),
  demo("z-asia", "Asia travel", (n) => ASIA.includes(n.iso2) && (n.costPerMb ?? 1) <= 0.01),
  demo("z-world", "Worldwide", (n) => n.iso2 !== "--"),
];

writeFileSync(
  new URL("lib/demo/seed/catalogue.json", root),
  JSON.stringify({ source: ["docs/reference/PriceList.csv", "docs/reference/location_zones_list.csv"], networks, zones }),
);
console.log(`networks: ${networks.length}, unpriced: ${networks.filter((n) => !priced(n)).length}`);
for (const z of zones) console.log(`  ${z.name}: ${z.networkIds.length} networks${z.missingTadigs.length ? `, ${z.missingTadigs.length} TADIGs not in the price list` : ""}`);
