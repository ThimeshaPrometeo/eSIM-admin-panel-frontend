"use client";

import { FitPage, FitScroll } from "@/components/platform/fit-page";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GlassCard } from "@/components/platform/glass-card";
import { EmptyState, PageHeader } from "@/components/platform/primitives";
import { useAction } from "@/hooks/use-action";
import { useResource } from "@/hooks/use-resource";
import { notificationsApi } from "@/lib/api/notifications";
import { formatDateTime, formatRelative } from "@/lib/platform/dates";
import { cn } from "@/lib/utils";

/** Notifications (spec 8.29): the list, mark as read, links to the related item. */
export function NotificationsClient() {
  const { data, loading } = useResource(() => notificationsApi.listNotifications(), ["notifications"]);
  const { run, pending } = useAction();
  const unread = (data ?? []).filter((n) => !n.read).length;
  return (
    <FitPage>
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} unread` : "You're all caught up."}
        actions={
          unread ? (
            <Button variant="secondary" disabled={pending} onClick={() => run(() => notificationsApi.markAllNotificationsRead(), { success: "All notifications marked as read" })}>
              Mark all as read
            </Button>
          ) : null
        }
      />
<FitScroll>
      <GlassCard padded={false}>
        {loading ? (
          <div className="flex flex-col gap-3 p-6">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : !data?.length ? (
          <EmptyState illustration="signal" title="No notifications" description="Alerts about your eSIMs, wallet and requests appear here." />
        ) : (
          <ul className="divide-y divide-border">
            {data.map((n) => (
              <li key={n.id} className="flex items-start gap-4 px-5 py-4 sm:px-6">
                <span aria-hidden="true" className={cn("mt-2 size-2 shrink-0 rounded-full", n.read ? "bg-border-strong" : "bg-primary shadow-[0_0_8px_var(--primary)]")} />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-body", n.read ? "text-fg-2" : "font-medium")}>{n.title}</p>
                  <p className="text-body text-fg-2">{n.body}</p>
                  <p className="mt-1 text-small text-fg-3" title={formatDateTime(n.createdAt)}>
                    {formatRelative(n.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!n.read ? (
                    <Button variant="ghost" size="sm" onClick={() => run(() => notificationsApi.markNotificationRead(n.id))}>
                      Mark as read
                    </Button>
                  ) : null}
                  {n.href ? (
                    <Button asChild variant="ghost" size="icon-sm" aria-label="Open">
                      <Link href={n.href} onClick={() => !n.read && void notificationsApi.markNotificationRead(n.id)}>
                        <ArrowRight strokeWidth={1.5} />
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
      </FitScroll>
    </FitPage>
  );
}
