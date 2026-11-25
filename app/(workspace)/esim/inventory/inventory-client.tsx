"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, PackagePlus } from "lucide-react";
import { ChartFill } from "@/components/platform/charts/chart-kit";
import { StockChart } from "@/components/platform/charts/charts";
import { FitPage, FitScroll, useFit } from "@/components/platform/fit-page";
import { GlassCard } from "@/components/platform/glass-card";
import { PageHeader, StatBlock } from "@/components/platform/primitives";
import { usePermission } from "@/hooks/use-permission";
import { useResource } from "@/hooks/use-resource";
import { operationsApi } from "@/lib/api/operations";
import { formatAxisDate, formatDate } from "@/lib/platform/dates";
import type { Inventory } from "@/lib/platform/types";
import { cn } from "@/lib/utils";

/** Inventory (spec 8.8): free eSIMs in the supplier pool vs assigned, 90-day trend, low-stock warning. */
export function InventoryClient() {
  const { data } = useResource(() => operationsApi.getInventory(), ["inventory"]);
  const perDay = data ? data.sold30d / 30 : 0;
  const daysLeft = data && perDay > 0 ? Math.floor(data.free / perDay) : null;
  const low = data ? data.free < data.threshold : false;
  const near = data ? !low && data.free < data.threshold * 1.25 : false;
  return (
    <FitPage>
      <PageHeader title="Inventory" description="Free eSIMs in the supplier pool and eSIMs already assigned. Every sale of a new eSIM takes one from the pool." />
      <GlassCard className="grid shrink-0 grid-cols-2 gap-6 sm:grid-cols-4">
        <StatBlock size="sm" label="Free now" value={data?.free ?? 0} format={(n) => String(n)} loading={!data} hint={data ? `Warning below ${data.threshold}` : undefined} />
        <StatBlock size="sm" label="Assigned" value={data?.assigned ?? 0} format={(n) => String(n)} loading={!data} hint="All eSIMs sold so far" />
        <StatBlock size="sm" label="New eSIMs, last 30 days" value={data?.sold30d ?? 0} format={(n) => String(Math.round(n))} loading={!data} hint={data ? `About ${perDay.toLocaleString("en-GB", { maximumFractionDigits: 1 })} a day` : undefined} />
        <StatBlock size="sm" label="Lasts at this pace" value={daysLeft ?? 0} format={(n) => (daysLeft === null ? "—" : `${Math.round(n)} days`)} loading={!data} hint="Free ÷ the last 30 days' daily sales" />
      </GlassCard>
      {data ? (
        <div
          role="status"
          className={cn(
            "flex shrink-0 items-start gap-3 rounded-card border px-4 py-3 text-body",
            low || near ? "border-[color-mix(in_oklab,var(--warning)_45%,transparent)] bg-[color-mix(in_oklab,var(--warning)_8%,transparent)]" : "border-border bg-surface-2/60",
          )}
        >
          {low || near ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" strokeWidth={1.5} /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={1.5} />}
          <span>
            {low
              ? `Only ${data.free} free eSIMs left, below the warning at ${data.threshold}. Ask the supplier for more stock.`
              : near
                ? `${data.free} free eSIMs left, close to the warning at ${data.threshold}${daysLeft !== null ? `; at the current pace that's about ${daysLeft} days` : ""}. Ask the supplier for more stock soon.`
                : `${data.free} free eSIMs; the warning is at ${data.threshold}.`}{" "}
            <WarningLink />
          </span>
        </div>
      ) : null}
      {data ? <Body data={data} /> : null}
    </FitPage>
  );
}

function WarningLink() {
  const { can } = usePermission();
  return can("settings") ? (
    <Link href="/esim/settings" className="text-primary hover:underline">
      Change the warning in Settings
    </Link>
  ) : null;
}

function Body({ data }: { data: Inventory }) {
  const fit = useFit();
  const series = data.series.map((x) => ({ label: formatAxisDate(x.date), free: x.free, assigned: x.assigned }));
  const deliveries = (
    <GlassCard className="flex flex-col gap-3">
      <h2 className="text-section font-semibold">Deliveries</h2>
      <p className="text-small text-fg-2">Stock added to the pool by the supplier.</p>
      <ul className="flex flex-col divide-y divide-border">
        {data.deliveries.map((d) => (
          <li key={d.reference} className="flex items-center justify-between gap-3 py-2.5">
            <span className="flex items-center gap-2.5">
              <PackagePlus className="size-4 text-accent" strokeWidth={1.5} />
              <span className="flex flex-col">
                <span className="text-body">{formatDate(`${d.date}T12:00:00Z`)}</span>
                <span className="font-mono text-small text-fg-3">{d.reference}</span>
              </span>
            </span>
            <span className="font-medium tabular text-accent">+{d.count}</span>
          </li>
        ))}
      </ul>
    </GlassCard>
  );
  return fit ? (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px] gap-4">
      <ChartFill>
        <StockChart data={series} threshold={data.threshold} />
      </ChartFill>
      <FitScroll className="xl:!mx-0 xl:!px-0">{deliveries}</FitScroll>
    </div>
  ) : (
    <div className="grid gap-4">
      <StockChart data={series} threshold={data.threshold} />
      {deliveries}
    </div>
  );
}
