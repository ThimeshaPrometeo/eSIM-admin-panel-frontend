import { CATALOGUE } from "./catalogue";
import { countryCount, type Network } from "@/lib/platform/coverage";
import type { ActivityEvent } from "@/lib/platform/activity";
import { demoActivityEvents } from "./activity";

/**
 * What the sign-in page reads from the data layer, in demo mode. With the real
 * backend: the country count from the networks endpoint, the events from the
 * activity feed and the status from the health check (BB backlog).
 */
export type SignInData = { countryCount: number; events: ActivityEvent[]; systemStatus: "operational" | null };

const networks: Network[] = CATALOGUE.networks;

export function demoSignInData(): SignInData {
  // No health check in demo mode, so no status line.
  return { countryCount: countryCount(networks), events: demoActivityEvents(networks, 12), systemStatus: null };
}
