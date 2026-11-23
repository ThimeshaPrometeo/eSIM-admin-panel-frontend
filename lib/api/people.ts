import { DATA_MODE } from "./mode";
import { demoPeople, type PeopleApi } from "./people.demo";
import { httpPeople } from "./people.http";

export type { ResellerInput, ResellerUpdate, AssistantInput } from "./people.demo";
export const peopleApi: PeopleApi = DATA_MODE === "api" ? httpPeople : demoPeople;
