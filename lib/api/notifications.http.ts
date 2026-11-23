import { apiFetch } from "./client";
import type { NotificationsApi } from "./notifications";
import type { AppNotification, Page } from "@/lib/platform/types";

export const httpNotifications: NotificationsApi = {
  listNotifications: () => apiFetch<Page<AppNotification>>("/notifications", { query: { pageSize: 50 } }).then((p) => p.data),
  unreadCount: () => apiFetch<Page<AppNotification>>("/notifications", { query: { unread: true, pageSize: 1 } }).then((p) => p.total),
  markNotificationRead: (id) => apiFetch<void>(`/notifications/${id}/read`, { method: "POST" }),
  markAllNotificationsRead: () => apiFetch<void>("/notifications/read-all", { method: "POST" }),
};
