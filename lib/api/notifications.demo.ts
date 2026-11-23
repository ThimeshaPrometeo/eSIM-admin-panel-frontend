import { read, write } from "@/lib/demo/run";
import { caller } from "@/lib/demo/session";
import type { AppNotification } from "@/lib/platform/types";

const own = () => {
  const c = caller();
  return { c, list: c.s.notifications.filter((n) => n.userId === c.u.id) };
};

export const demoNotifications = {
  listNotifications: () => read((): AppNotification[] => own().list.map((n) => ({ id: n.id, title: n.title, body: n.body, href: n.href, createdAt: n.createdAt, read: n.read }))),
  unreadCount: () => read(() => own().list.filter((n) => !n.read).length),
  markNotificationRead: (id: string) =>
    write(() => {
      const n = own().list.find((x) => x.id === id);
      if (n) n.read = true;
    }),
  markAllNotificationsRead: () =>
    write(() => {
      own().list.forEach((n) => (n.read = true));
    }),
};
