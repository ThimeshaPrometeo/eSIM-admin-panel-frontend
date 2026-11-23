import { DATA_MODE } from "./mode";
import { demoAccounts, type AccountsApi } from "./accounts.demo";
import { httpAccounts } from "./accounts.http";

export type { AuditFilters, StaffUserInput, UserFilters } from "./accounts.demo";
export const accountsApi: AccountsApi = DATA_MODE === "api" ? httpAccounts : demoAccounts;
