/** Deterministic sample data for the design-system page only. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r = rng(20261119);

const DAY_LABELS = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 9, 21 + i));
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
});

export const dailyUsage = DAY_LABELS.map((label, i) => {
  const base = 38 + i * 0.9 + Math.sin(i / 3) * 6 + r() * 8;
  const v = Math.round(base * 10) / 10;
  const isEstimated = i >= 28;
  return { label, final: i <= 28 ? v : null, estimated: isEstimated ? v : null };
});

export const monthlyUsage = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"].map((label, i) => ({
  label,
  value: Math.round(620 + i * 140 + r() * 120),
}));

export const esimStatus = [
  { label: "Active", value: 86, tone: "accent" as const },
  { label: "Suspended", value: 9, tone: "danger" as const },
  { label: "Expired", value: 14, tone: "neutral" as const },
  { label: "In stock", value: 23, tone: "primary" as const },
];

export const plansSold = [
  { label: "Italy 1 GB", value: 18 },
  { label: "Italy 3 GB", value: 41 },
  { label: "Italy 5 GB", value: 22 },
  { label: "Europe 5 GB", value: 33 },
  { label: "Europe 10 GB", value: 27 },
  { label: "Asia 5 GB", value: 15 },
  { label: "World 10 GB", value: 9 },
];

export const transactions = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"].map((label, i) => ({
  label,
  credits: Math.round(1800 + i * 260 + r() * 400),
  debits: Math.round(1500 + i * 240 + r() * 380),
}));

export const topEsims = Array.from({ length: 10 }, (_, i) => ({
  id: `esim-${i + 1}`,
  label: `…${String(4417 + i * 731).padStart(4, "0")}`,
  value: Math.round((14.8 - i * 1.15 + r() * 0.6) * 10) / 10,
}));

export const usageByCountry = [
  ["Italy", 412], ["France", 268], ["Spain", 231], ["UAE", 188], ["Thailand", 164],
  ["Japan", 131], ["UK", 117], ["Singapore", 96],
].map(([label, value]) => ({ label: String(label), value: Number(value) }));

export const revenue = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"].map((label, i) => {
  const revenue = Math.round(2400 + i * 380 + r() * 300);
  const cost = Math.round(revenue * (0.68 - r() * 0.05));
  return { label, revenue, cost, profit: revenue - cost };
});

export const sampleEsims = [
  { iccid: "8937204016152290417", status: "ACTIVE", install: "enabled", plan: "Italy 3 GB", used: 2.1, limit: 3, customer: "Amaya Jayasinghe", reseller: "Lanka Roam Travels" },
  { iccid: "8937204016152291028", status: "ACTIVE", install: "installed", plan: "Europe 10 GB", used: 8.6, limit: 10, customer: "Tharindu Wijeratne", reseller: "Blue Horizon Tours" },
  { iccid: "8937204016152291835", status: "SUSPENDED", install: "disabled", plan: "Asia 5 GB", used: 5, limit: 5, customer: "Nethmi Rajapaksa", reseller: "Nomad Connect" },
  { iccid: "8937204016152292204", status: "ACTIVE", install: "unknown", raw: "Pending-Download-Retry", plan: "Italy 1 GB", used: 0, limit: 1, customer: "—", reseller: "Direct" },
] as const;

/** Arcs from Colombo to popular destinations. */
export const sampleArcs: [string, string][] = [
  ["LK", "IT"], ["LK", "FR"], ["LK", "GB"], ["LK", "AE"], ["LK", "SG"], ["LK", "TH"],
  ["LK", "JP"], ["LK", "AU"], ["LK", "DE"], ["LK", "TR"], ["IT", "US"], ["AE", "ES"],
];
export const dashboardArcs: [string, string][] = [["LK", "IT"], ["LK", "AE"], ["LK", "TH"], ["LK", "JP"], ["LK", "FR"]];
