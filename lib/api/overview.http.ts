import { apiFetch } from "./client";
import type { OverviewApi } from "./overview.demo";
import type { Overview } from "@/lib/platform/types";

/** One call for the whole dashboard (backend backlog BB-30). The backend scopes it to the caller. */
export const httpOverview: OverviewApi = {
  getOverview: (q) =>
    apiFetch<Overview>("/dashboard/overview", {
      query: { from: q.from, to: q.to, granularity: q.granularity, compare: q.compare ? "1" : "0", resellerId: q.resellerId, country: q.iso2, networkId: q.networkId, planId: q.planId },
    }),
};
