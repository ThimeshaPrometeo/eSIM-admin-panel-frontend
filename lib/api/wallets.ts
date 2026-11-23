import { DATA_MODE } from "./mode";
import { demoWallets, type WalletsApi } from "./wallets.demo";
import { httpWallets } from "./wallets.http";

export type { TransactionFilters } from "./wallets.demo";
export const walletsApi: WalletsApi = DATA_MODE === "api" ? httpWallets : demoWallets;
