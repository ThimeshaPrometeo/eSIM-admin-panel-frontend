import { describe, expect, it } from "vitest";
import { countryCount, countryFlag, pricedCountries, type Network } from "./coverage";
import { activityText } from "./activity";
import { demoActivityEvents } from "@/lib/demo/activity";
import { CATALOGUE } from "@/lib/demo/catalogue";

const net = (iso2: string, costPerMb: number | null, nr = false): Network => ({ id: iso2, iso2, country: iso2, operator: "op", tadigs: [], mccMnc: "", costPerMb, lte: true, nr, volte: false });

describe("coverage", () => {
  it("counts countries with at least one priced network", () => {
    const list = [net("IT", 0.001), net("IT", 0.002), net("JP", 0), net("ES", null), net("FR", 0.003), net("--", 0.01)];
    expect(pricedCountries(list)).toEqual(["FR", "IT"]);
    expect(countryCount(list)).toBe(2);
  });

  it("builds flag emoji", () => {
    expect(countryFlag("it")).toBe("🇮🇹");
    expect(countryFlag("--")).toBe("🌐");
  });
});

describe("activity", () => {
  it("formats events", () => {
    expect(activityText({ id: "1", iso2: "IT", country: "Italy", kind: "installed" })).toBe("Italy · eSIM installed");
    expect(activityText({ id: "2", iso2: "AE", country: "UAE", kind: "on5g" })).toBe("UAE · Now on 5G");
    expect(activityText({ id: "3", iso2: "ES", country: "Spain", kind: "usage", bytesToday: 1.2 * 1024 ** 3 })).toBe("Spain · 1.2 GB used today");
  });

  it("demo events only use priced countries, and 5G only where a priced 5G network exists", () => {
    const networks = CATALOGUE.networks;
    const priced = new Set(pricedCountries(networks));
    const events = demoActivityEvents(networks, 24);
    expect(events.length).toBe(24);
    for (const e of events) {
      expect(priced.has(e.iso2)).toBe(true);
      if (e.kind === "on5g") expect(networks.some((n) => n.iso2 === e.iso2 && n.nr && (n.costPerMb ?? 0) > 0)).toBe(true);
    }
    expect(demoActivityEvents(networks, 24)).toEqual(events); // deterministic
  });
});
