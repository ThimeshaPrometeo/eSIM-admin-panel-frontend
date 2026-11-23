import { DATA_MODE } from "./mode";
import { demoOperations, type OperationsApi } from "./operations.demo";
import { httpOperations } from "./operations.http";

export type { AlertFilters, CustomerInput, RuleInput, UsageFilters } from "./operations.demo";
export const operationsApi: OperationsApi = DATA_MODE === "api" ? httpOperations : demoOperations;
