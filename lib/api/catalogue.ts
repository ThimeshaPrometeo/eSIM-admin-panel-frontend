import { DATA_MODE } from "./mode";
import { demoCatalogue, type CatalogueApi } from "./catalogue.demo";
import { httpCatalogue } from "./catalogue.http";

export type { PlanInput, ResellerPlanInput, DiscountInput } from "./catalogue.demo";
export const catalogueApi: CatalogueApi = DATA_MODE === "api" ? httpCatalogue : demoCatalogue;
