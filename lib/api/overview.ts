import { DATA_MODE } from "./mode";
import { demoOverview, type OverviewApi } from "./overview.demo";
import { httpOverview } from "./overview.http";

export const overviewApi: OverviewApi = DATA_MODE === "api" ? httpOverview : demoOverview;
