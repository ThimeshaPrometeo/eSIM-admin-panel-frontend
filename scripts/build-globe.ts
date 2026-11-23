/**
 * Builds the bundled globe geometry (spec 7.5, 7.10): nothing is fetched at
 * run time.
 *
 *   pnpm build:globe
 *
 * Output (committed):
 *   lib/geo/globe-mask.json        land/country mask (equirectangular, run-length
 *                                  encoded) + one label point per country. The
 *                                  globe places its dots at run time and looks
 *                                  each one up here, so dot density is a render
 *                                  setting, not a file-size cost.
 *   lib/geo/sample-coverage.json   covered countries from the reference price
 *                                  list (design-system page only)
 *   public/globe-fallback-*.svg    static globe for no WebGL / low power
 *
 * Source geometry: the world-atlas npm package (Natural Earth 1:50m).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { feature } from "topojson-client";
import { geoArea, geoBounds, geoCentroid, geoContains, geoDistance, geoOrthographic } from "d3-geo";
import countries from "i18n-iso-countries";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";

const require = createRequire(import.meta.url);
const topo = require("world-atlas/countries-50m.json") as Topology<{ countries: GeometryCollection }>;
const root = new URL("../", import.meta.url);

/** Mask resolution: 0.4° cells. */
const W = 900;
const H = 450;

type CountryFeature = Feature<Polygon | MultiPolygon, { name: string }> & { id?: string };

// Natural Earth names without an ISO numeric code.
const NAME_FALLBACK: Record<string, string> = {
  Kosovo: "XK",
  "N. Cyprus": "CY",
  Somaliland: "SO",
  Antarctica: "AQ",
  "Fr. S. Antarctic Lands": "TF",
  "Indian Ocean Ter.": "",
  "Ashmore and Cartier Is.": "",
  "Siachen Glacier": "IN",
};

const fc = feature(topo, topo.objects.countries) as unknown as { features: CountryFeature[] };
const shapes = fc.features
  .map((f) => {
    const iso2 = ((f.id ? countries.numericToAlpha2(f.id) : undefined) ?? NAME_FALLBACK[f.properties.name] ?? "").toUpperCase();
    const [[w, s], [e, n]] = geoBounds(f);
    return { f, iso2, w, s, e, n };
  })
  .filter((c) => c.iso2);

const isoList = [...new Set(shapes.map((s) => s.iso2))].sort();
const isoIndex = new Map(isoList.map((iso, i) => [iso, i]));

function inBounds(c: (typeof shapes)[number], lon: number, lat: number) {
  if (lat < c.s || lat > c.n) return false;
  return c.w <= c.e ? lon >= c.w && lon <= c.e : lon >= c.w || lon <= c.e;
}

// ---- mask: 0 = ocean, i + 1 = country i
const mask = new Uint16Array(W * H);
for (let y = 0; y < H; y++) {
  const lat = 90 - ((y + 0.5) / H) * 180;
  const candidates = shapes.filter((c) => lat >= c.s && lat <= c.n);
  for (let x = 0; x < W; x++) {
    const lon = ((x + 0.5) / W) * 360 - 180;
    const hit = candidates.find((c) => inBounds(c, lon, lat) && geoContains(c.f, [lon, lat]));
    if (hit) mask[y * W + x] = isoIndex.get(hit.iso2)! + 1;
  }
}

// ---- label point per country: centroid of its largest polygon
const centroids: Record<string, [number, number]> = {};
for (const iso of isoList) {
  let best: { area: number; c: [number, number] } | null = null;
  for (const s of shapes.filter((x) => x.iso2 === iso)) {
    const polys = s.f.geometry.type === "Polygon" ? [s.f.geometry.coordinates] : s.f.geometry.coordinates;
    for (const coords of polys) {
      const poly: Feature<Polygon> = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: coords } };
      const area = geoArea(poly);
      if (!best || area > best.area) {
        const [lon, lat] = geoCentroid(poly);
        best = { area, c: [Math.round(lat * 100) / 100, Math.round(lon * 100) / 100] };
      }
    }
  }
  if (best) centroids[iso] = best.c;
}

// Countries too small for any cell (Singapore, Malta, ...) still get their label cell.
const present = new Set(mask);
for (const [iso, [lat, lon]] of Object.entries(centroids)) {
  const v = isoIndex.get(iso)! + 1;
  if (present.has(v)) continue;
  const x = Math.min(W - 1, Math.floor(((lon + 180) / 360) * W));
  const y = Math.min(H - 1, Math.floor(((90 - lat) / 180) * H));
  mask[y * W + x] = v;
}

// ---- run-length encode per row: [value, length, value, length, ...]
const rows: number[][] = [];
for (let y = 0; y < H; y++) {
  const row: number[] = [];
  let v = mask[y * W]!;
  let len = 0;
  for (let x = 0; x < W; x++) {
    const c = mask[y * W + x]!;
    if (c === v) len++;
    else {
      row.push(v, len);
      v = c;
      len = 1;
    }
  }
  row.push(v, len);
  rows.push(row);
}

mkdirSync(new URL("lib/geo/", root), { recursive: true });
writeFileSync(
  new URL("lib/geo/globe-mask.json", root),
  JSON.stringify({ source: "Natural Earth 1:50m via world-atlas", width: W, height: H, countries: isoList, centroids, rows }),
);

// ---- covered countries (design-system page only)
const priceList = readFileSync(new URL("docs/reference/PriceList.csv", root), "utf8");
const covered = new Set(
  priceList
    .split("\n")
    .slice(1)
    .map((line) => [...line.matchAll(/("([^"]*)"|[^,]*)(,|$)/g)].map((m) => m[2] ?? m[1])[2]?.toUpperCase())
    .filter((iso): iso is string => !!iso && /^[A-Z]{2}$/.test(iso)),
);
writeFileSync(
  new URL("lib/geo/sample-coverage.json", root),
  JSON.stringify({ source: "docs/reference/PriceList.csv", countries: [...covered].sort() }),
);

// ---- static fallback SVGs (same Fibonacci dots the live globe uses)
function landAt(lat: number, lon: number) {
  const x = Math.min(W - 1, Math.max(0, Math.floor(((lon + 180) / 360) * W)));
  const y = Math.min(H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * H)));
  return mask[y * W + x]!;
}
function fallbackSvg(theme: "dark" | "light") {
  const size = 640;
  const radius = 290;
  const center: [number, number] = [55, 18];
  const projection = geoOrthographic().scale(radius).translate([size / 2, size / 2]).rotate([-center[0], -center[1]]);
  const pal =
    theme === "dark"
      ? { in: "#0F1B2E", out: "#050A14", dot: "#00E5A0", halo: "#0080FF", edge: "#3D8BFF" }
      : { in: "#FFFFFF", out: "#E6EDF7", dot: "#00A877", halo: "#0066E0", edge: "#0066E0" };
  const golden = Math.PI * (3 - Math.sqrt(5));
  const N = 60000;
  const dots: string[] = [];
  for (let i = 0; i < N; i++) {
    const yy = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - yy * yy);
    const th = golden * i;
    const lat = (Math.asin(yy) * 180) / Math.PI;
    const lon = ((((Math.atan2(Math.sin(th) * r, Math.cos(th) * r) * 180) / Math.PI + 540) % 360) - 180);
    if (!landAt(lat, lon)) continue;
    if (geoDistance([lon, lat], center) > Math.PI / 2 - 0.03) continue;
    const p = projection([lon, lat]);
    if (p) dots.push(`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${(0.9 * Math.max(0.65, Math.cos((lat * Math.PI) / 180))).toFixed(2)}"/>`);
  }
  const c = size / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="Globe">
<defs>
<radialGradient id="s" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="${pal.in}"/><stop offset="1" stop-color="${pal.out}"/></radialGradient>
<radialGradient id="h" cx="50%" cy="50%" r="50%"><stop offset="0.8" stop-color="${pal.halo}" stop-opacity="0.22"/><stop offset="1" stop-color="${pal.halo}" stop-opacity="0"/></radialGradient>
</defs>
<circle cx="${c}" cy="${c}" r="${radius * 1.18}" fill="url(#h)"/>
<circle cx="${c}" cy="${c}" r="${radius}" fill="url(#s)"/>
<g fill="${pal.dot}" fill-opacity="${theme === "dark" ? 0.8 : 0.9}">${dots.join("")}</g>
<circle cx="${c}" cy="${c}" r="${radius - 0.5}" fill="none" stroke="${pal.edge}" stroke-opacity="0.35" stroke-width="1"/>
</svg>`;
}
writeFileSync(new URL("public/globe-fallback-dark.svg", root), fallbackSvg("dark"));
writeFileSync(new URL("public/globe-fallback-light.svg", root), fallbackSvg("light"));

const runs = rows.reduce((s, r) => s + r.length / 2, 0);
console.log(`${isoList.length} countries, ${runs} runs, ${covered.size} covered`);
