/** A mobile network from the supplier's price list (demo catalogue / synced tables). */
export type Network = {
  id: string;
  /** ISO 3166-1 alpha-2, or "--" for networks without a country (satellite). */
  iso2: string;
  /** Display name of the country (short form for long names, e.g. "UAE"). */
  country: string;
  operator: string;
  tadigs: string[];
  mccMnc: string;
  /** Supplier price in EUR per MB; null = unavailable (never priced at 0). */
  costPerMb: number | null;
  lte: boolean;
  nr: boolean;
  volte: boolean;
};

export function isPriced(n: Pick<Network, "costPerMb">): boolean {
  return typeof n.costPerMb === "number" && n.costPerMb > 0;
}

export function isCountry(iso2: string): boolean {
  return /^[A-Z]{2}$/.test(iso2);
}

/** ISO codes of countries with at least one priced network, sorted. */
export function pricedCountries(networks: readonly Network[]): string[] {
  return [...new Set(networks.filter((n) => isPriced(n) && isCountry(n.iso2)).map((n) => n.iso2))].sort();
}

export function countryCount(networks: readonly Network[]): number {
  return pricedCountries(networks).length;
}

/** Flag emoji for an ISO 3166-1 alpha-2 code ("IT" -> 🇮🇹); a globe for anything else. */
export function countryFlag(iso2: string): string {
  const code = iso2.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "🌐";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
