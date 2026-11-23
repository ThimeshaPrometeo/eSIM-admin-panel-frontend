import { countryFlag } from "./coverage";

/** A recent platform event, shown on the sign-in globe and in the mobile ticker. */
export type ActivityEvent =
  | { id: string; iso2: string; country: string; kind: "installed" | "activated" | "on5g" }
  | { id: string; iso2: string; country: string; kind: "usage"; bytesToday: number };

const GB = 1024 ** 3;
const MB = 1024 ** 2;

function formatBytes(bytes: number): string {
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / MB))} MB`;
}

/** "Italy · eSIM installed", "UAE · Now on 5G", "Spain · 1.2 GB used today". */
export function activityText(e: ActivityEvent): string {
  switch (e.kind) {
    case "installed":
      return `${e.country} · eSIM installed`;
    case "activated":
      return `${e.country} · Plan activated`;
    case "on5g":
      return `${e.country} · Now on 5G`;
    case "usage":
      return `${e.country} · ${formatBytes(e.bytesToday)} used today`;
  }
}

export function activityFlag(e: ActivityEvent): string {
  return countryFlag(e.iso2);
}
