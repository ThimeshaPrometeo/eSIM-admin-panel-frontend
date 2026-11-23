"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { usePlatform } from "@/contexts/platform-context";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useResource } from "@/hooks/use-resource";
import { notificationsApi } from "@/lib/api/notifications";
import { formatRelative } from "@/lib/platform/dates";
import { cn } from "@/lib/utils";

/** Bell with the unread count (spec 8.29); the latest notifications, mark as read, links to the item. */
export function NotificationBell() {
  const { unread, refresh } = usePlatform();
  const router = useRouter();
  const { data } = useResource(() => notificationsApi.listNotifications(), ["bell"]);
  const latest = (data ?? []).slice(0, 6);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative grid size-10 place-items-center rounded-full text-fg-2 outline-none transition-colors hover:bg-surface-3 hover:text-fg focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      >
        <Bell className="size-5" strokeWidth={1.5} />
        {unread ? (
          <span className="absolute right-1 top-1 grid min-w-[18px] place-items-center rounded-full bg-primary-solid px-1 text-[11px] font-semibold leading-[18px] text-on-solid shadow-[0_0_10px_var(--primary-glow)] tabular">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(380px,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <p className="text-body font-semibold">Notifications</p>
          {unread ? (
            <button
              className="text-small font-medium text-primary hover:underline"
              onClick={async () => {
                await notificationsApi.markAllNotificationsRead();
                refresh();
              }}
            >
              Mark all as read
            </button>
          ) : null}
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-1">
          {latest.length === 0 ? (
            <p className="px-3 py-6 text-center text-body text-fg-3">{"You're all caught up."}</p>
          ) : (
            latest.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className="items-start gap-3 py-2.5"
                onSelect={async () => {
                  if (!n.read) await notificationsApi.markNotificationRead(n.id);
                  refresh();
                  if (n.href) router.push(n.href);
                }}
              >
                <span aria-hidden="true" className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary shadow-[0_0_8px_var(--primary)]")} />
                <span className="min-w-0">
                  <span className={cn("block text-body", n.read ? "text-fg-2" : "font-medium text-fg")}>{n.title}</span>
                  <span className="block text-small text-fg-3">{n.body}</span>
                  <span className="mt-0.5 block text-small text-fg-3">{formatRelative(n.createdAt)}</span>
                </span>
              </DropdownMenuItem>
            ))
          )}
        </div>
        <DropdownMenuSeparator className="my-0" />
        <Link href="/notifications" className="block px-4 py-3 text-center text-small font-medium text-primary hover:underline">
          View all notifications
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
