import { DATA_MODE } from "./mode";
import { demoNotifications } from "./notifications.demo";
import { httpNotifications } from "./notifications.http";

export type NotificationsApi = typeof demoNotifications;
export const notificationsApi: NotificationsApi = DATA_MODE === "api" ? httpNotifications : demoNotifications;
