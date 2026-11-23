import { DATA_MODE } from "./mode";
import { demoAuth } from "./auth.demo";
import { httpAuth } from "./auth.http";

export type { LoginResult } from "./auth.demo";
export type AuthApi = typeof demoAuth;
export const authApi: AuthApi = DATA_MODE === "api" ? httpAuth : demoAuth;
