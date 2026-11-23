import { DATA_MODE } from "./mode";
import { demoFinance, type FinanceApi } from "./finance.demo";
import { httpFinance } from "./finance.http";

export type { SimulateInput, ChargeQuery } from "./finance.demo";
export const financeApi: FinanceApi = DATA_MODE === "api" ? httpFinance : demoFinance;
