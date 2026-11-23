import { DATA_MODE } from "./mode";
import { demoEsims, type EsimsApi } from "./esims.demo";
import { httpEsims } from "./esims.http";

export type { EsimFilters, OrderFilters, SimulatedOutcome } from "./esims.demo";
export const esimsApi: EsimsApi = DATA_MODE === "api" ? httpEsims : demoEsims;
