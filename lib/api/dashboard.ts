import { DATA_MODE } from "./mode";
import { demoDashboard, type DashboardApi } from "./dashboard.demo";
import { httpDashboard } from "./dashboard.http";

export const dashboardApi: DashboardApi = DATA_MODE === "api" ? httpDashboard : demoDashboard;
