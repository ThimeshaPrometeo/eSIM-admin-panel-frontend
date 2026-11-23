"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, CircleX, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyButton, Detail } from "@/components/platform/fields";
import { FitPage, FitScroll } from "@/components/platform/fit-page";
import { GlassCard } from "@/components/platform/glass-card";
import { PageHeader } from "@/components/platform/primitives";
import { StatusChip } from "@/components/platform/status-chip";
import { useAction } from "@/hooks/use-action";
import { usePermission } from "@/hooks/use-permission";
import { useResource } from "@/hooks/use-resource";
import { operationsApi } from "@/lib/api/operations";
import { formatDate, formatDateTime, formatRelative } from "@/lib/platform/dates";
import { formatMoney } from "@/lib/platform/money";
import type { SupplierJob, SupplierStatus } from "@/lib/platform/types";
import { cn } from "@/lib/utils";

const RESULT = {
  ok: { icon: CheckCircle2, className: "text-accent", label: "OK" },
  warning: { icon: AlertTriangle, className: "text-warning", label: "Needs a look" },
  failed: { icon: CircleX, className: "text-danger", label: "Failed" },
} as const;

/** Yesim connection (spec 8.27): admin manages, staff view. */
export function YesimClient() {
  const { data } = useResource(() => operationsApi.getSupplierStatus(), ["supplier-status"]);
  return (
    <FitPage>
      <PageHeader title="Yesim connection" description="Our single account at Yesim: what the backend found, the scheduled jobs, and the notifications Yesim sends us." />
      <FitScroll>{!data ? <Skeleton className="h-96" /> : <Body d={data} />}</FitScroll>
    </FitPage>
  );
}

function Body({ d }: { d: SupplierStatus }) {
  const ok = Math.abs(d.balance.difference) <= d.balance.tolerance;
  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <GlassCard className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-section font-semibold">Connection</h2>
            <StatusChip status={d.status === "ok" ? { label: "Connected", tone: "positive" } : d.status === "degraded" ? { label: "Degraded", tone: "warning" } : { label: "Down", tone: "danger" }} />
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Detail label="Reseller account">
              <span className="font-mono text-small">{d.account.reseller}</span>
            </Detail>
            <Detail label="Sponsor">
              <span className="font-mono text-small">{d.account.sponsor}</span>
            </Detail>
            <Detail label="Network profile">
              <span className="font-mono text-small">{d.account.networkProfile}</span>
            </Detail>
            <Detail label="Write mode">{d.account.writeMode === "read_only" ? "Read only" : "Enabled"}</Detail>
          </dl>
          <p className="mt-auto text-small text-fg-3">Found by the backend; checked {formatRelative(d.checkedAt)}. Set on the server, not here.</p>
        </GlassCard>

        <GlassCard className="flex flex-col gap-4">
          <h2 className="text-section font-semibold">Sale limits</h2>
          <Meter label="Sales today" used={d.limits.salesToday} limit={d.limits.dailySaleLimit} hint="Resets at midnight. Further sales are refused once it's reached." />
          <Meter label="Total cap" used={d.limits.capUsed} limit={d.limits.saleCap} hint="Set by Yesim for this account." />
        </GlassCard>

        <GlassCard className="flex flex-col gap-3">
          <h2 className="text-section font-semibold">Balance at Yesim</h2>
          <dl className="flex flex-col gap-1.5 text-body">
            <Row label="Yesim reports" value={formatMoney(d.balance.reported)} strong />
            <Row label="Our records imply" value={formatMoney(d.balance.implied)} />
            <Row label="Difference" value={formatMoney(d.balance.difference)} tone={ok ? "text-accent" : "text-danger"} />
            <Row label="House wallet" value={formatMoney(d.balance.houseWallet)} />
          </dl>
          <p className="flex items-start gap-2 text-small text-fg-2">
            {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={1.5} /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" strokeWidth={1.5} />}
            {ok ? `Within the ${formatMoney(d.balance.tolerance)} tolerance.` : `Outside the ${formatMoney(d.balance.tolerance)} tolerance.`} Reported {formatRelative(d.balance.reportedAt)}.
          </p>
          <Link href="/esim/profit?tab=reconciliation" className="mt-auto inline-flex items-center gap-1 text-small font-medium text-primary hover:underline">
            Reconciliation
            <ArrowRight className="size-3.5" strokeWidth={1.75} />
          </Link>
        </GlassCard>

        <GlassCard className="flex flex-col gap-3">
          <h2 className="text-section font-semibold">Price list</h2>
          <p className="text-section font-semibold tabular">Version {d.priceList.version}</p>
          <p className="text-body text-fg-2">
            In force since {formatDate(`${d.priceList.effectiveFrom}T12:00:00Z`)}: {d.priceList.rises} price{d.priceList.rises === 1 ? "" : "s"} up, {d.priceList.falls} down.
          </p>
          <p className="text-small text-fg-3">Last sync {formatRelative(d.priceList.syncedAt)}, no changes since.</p>
          <Link href="/esim/price-list?tab=history" className="mt-auto inline-flex items-center gap-1 text-small font-medium text-primary hover:underline">
            What changed
            <ArrowRight className="size-3.5" strokeWidth={1.75} />
          </Link>
        </GlassCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Jobs jobs={d.jobs} />
        <div className="flex flex-col gap-4">
          <GlassCard className="flex flex-col gap-3">
            <h2 className="text-section font-semibold">Webhook addresses</h2>
            <p className="text-small text-fg-2">Yesim sends usage and eSIM status changes here. Each address holds a secret, shown masked.</p>
            <ul className="flex flex-col gap-2">
              {d.webhooks.map((w) => (
                <Webhook key={w.path} label={w.label} path={w.path} masked={w.secretMasked} />
              ))}
            </ul>
          </GlassCard>
          <GlassCard className="flex flex-col gap-2">
            <h2 className="text-section font-semibold">Latest notifications from Yesim</h2>
            <ul className="flex flex-col divide-y divide-border">
              {d.events.slice(0, 6).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-2 text-body">
                      <span className="font-mono text-small text-fg-2">{e.type}</span>
                      {e.esimId ? (
                        <Link href={`/esim/esims/${e.esimId}`} className="font-mono text-small hover:text-primary">
                          …{e.iccid?.slice(-6)}
                        </Link>
                      ) : null}
                    </span>
                    <span className="text-small text-fg-3">{e.detail}</span>
                  </span>
                  <span className="shrink-0 text-small text-fg-2" title={formatDateTime(e.at)}>
                    {formatRelative(e.at)}
                  </span>
                </li>
              ))}
            </ul>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function Jobs({ jobs }: { jobs: SupplierJob[] }) {
  const { me } = usePermission();
  const { run, pending } = useAction();
  const admin = me?.role === "admin";
  return (
    <GlassCard className="flex flex-col gap-2">
      <h2 className="text-section font-semibold">Scheduled jobs</h2>
      <ul className="flex flex-col divide-y divide-border">
        {jobs.map((j) => {
          const R = RESULT[j.result];
          return (
            <li key={j.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
              <R.icon className={cn("size-4 shrink-0", R.className)} strokeWidth={1.75} aria-label={R.label} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-body font-medium">
                  {j.label} <span className="font-normal text-fg-3">· {j.schedule}</span>
                </span>
                <span className="text-small text-fg-2">{j.message}</span>
              </span>
              <span className="flex flex-col items-end text-small">
                <span title={formatDateTime(j.lastRunAt)}>Last {formatRelative(j.lastRunAt)}</span>
                <span className="text-fg-3 tabular">{(j.durationMs / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1 })} s</span>
              </span>
              {j.manual && admin ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => run(() => operationsApi.runSupplierJob(j.id as "catalogue_sync" | "price_list_sync"), { success: `${j.label} finished`, description: "No changes at Yesim." })}
                >
                  <RefreshCw strokeWidth={1.5} />
                  Sync now
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </GlassCard>
  );
}

function Meter({ label, used, limit, hint }: { label: string; used: number; limit: number; hint: string }) {
  const f = limit > 0 ? Math.min(1, used / limit) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between text-body">
        {label}
        <span className="font-medium tabular">
          {used} <span className="text-fg-3">of {limit}</span>
        </span>
      </span>
      <span className="h-2 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={`${used} of ${limit}`}>
        <span className={cn("block h-full rounded-full", f >= 1 ? "bg-danger" : f >= 0.8 ? "bg-warning" : "bg-primary")} style={{ width: `${f * 100}%` }} />
      </span>
      <span className="text-small text-fg-3">{hint}</span>
    </div>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-fg-2">{label}</dt>
      <dd className={cn("tabular", strong && "font-semibold", tone)}>{value}</dd>
    </div>
  );
}

const noop = () => () => {};
function Webhook({ label, path, masked }: { label: string; path: string; masked: boolean }) {
  // the full address uses this site's origin; known only in the browser
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  const url = `${origin}${path}`;
  return (
    <li className="flex items-center justify-between gap-2 rounded-control border border-border px-3 py-2">
      <span className="flex min-w-0 flex-col">
        <span className="text-small text-fg-2">{label}</span>
        <span className="truncate font-mono text-small">{url}</span>
      </span>
      {masked ? <span className="shrink-0 text-small text-fg-3">Secret hidden</span> : <CopyButton value={url} label="Copy address" />}
    </li>
  );
}
