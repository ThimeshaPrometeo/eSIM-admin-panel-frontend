"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/components/platform/data-table";
import { DemoZoneChip, Detail, SearchInput } from "@/components/platform/fields";
import { GlassCard } from "@/components/platform/glass-card";
import { NetworkBadges } from "@/components/platform/network-badges";
import { PlanFormDialog } from "@/components/platform/plan-dialogs";
import { EmptyState } from "@/components/platform/primitives";
import { StatusChip } from "@/components/platform/status-chip";
import { usePermission } from "@/hooks/use-permission";
import { useResource } from "@/hooks/use-resource";
import { catalogueApi } from "@/lib/api/catalogue";
import { errorMessage } from "@/lib/api/errors";
import { countryFlag } from "@/lib/platform/coverage";
import { formatMoney, formatPerGb, formatPerMb } from "@/lib/platform/money";
import { PLAN_STATUS } from "@/lib/platform/status-labels";
import type { ZoneNetworkPrice } from "@/lib/platform/types";
import { formatPlanData } from "@/lib/platform/units";

/** Plan detail (spec 8.10): the zone's networks with supplier cost, example reseller prices, sold count. */
export function PlanDetailClient({ id }: { id: string }) {
  const { me, rules } = usePermission();
  const { data: plan, error } = useResource(() => catalogueApi.getPlan(id), [id]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(false);

  if (error) return <EmptyState illustration="sim" title="Plan not found" description={errorMessage(error)} action={<Button asChild variant="secondary"><Link href="/esim/plans">Back to plans</Link></Button>} />;

  const examples = plan?.networks[0]?.examples.map((e) => e.resellerName) ?? [];
  const columns: Column<ZoneNetworkPrice>[] = [
    { id: "country", header: "Country", cell: (n) => <span className="flex items-center gap-2"><span>{countryFlag(n.iso2)}</span>{n.country}</span>, sortValue: (n) => n.country, hideable: false },
    { id: "network", header: "Network", cell: (n) => n.operator, sortValue: (n) => n.operator },
    { id: "tech", header: "Technology", cell: (n) => <NetworkBadges lte={n.lte} fiveG={n.nr} volte={n.volte} /> },
    { id: "cost", header: "Supplier €/MB", align: "right", cell: (n) => (n.costPerMb === null ? <span className="text-danger">No price</span> : formatPerMb(n.costPerMb)), sortValue: (n) => n.costPerMb },
    ...examples.map((name, i) => ({
      id: `ex${i}`,
      header: `${name} €/GB`,
      align: "right" as const,
      cell: (n: ZoneNetworkPrice) => formatPerGb(n.examples[i]?.pricePerMb),
      sortValue: (n: ZoneNetworkPrice) => n.examples[i]?.pricePerMb ?? null,
    })),
  ];
  const rows = (plan?.networks ?? []).filter((n) => !q || n.country.toLowerCase().includes(q.toLowerCase()) || n.operator.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href="/esim/plans">
          <ArrowLeft strokeWidth={1.5} />
          Plans
        </Link>
      </Button>
      {!plan ? (
        <Skeleton className="h-40" />
      ) : (
        <GlassCard>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-title font-semibold">{plan.name}</h1>
                <StatusChip status={PLAN_STATUS[plan.status]} />
              </div>
              <p className="mt-1 flex items-center gap-2 text-body text-fg-2">
                {plan.zoneName} {plan.demoZone ? <DemoZoneChip /> : null} · {plan.countryCount} countries · {plan.networkCount} networks
              </p>
            </div>
            {rules.canEditPlans(me) ? (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Pencil strokeWidth={1.5} />
                Edit plan
              </Button>
            ) : null}
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-5">
            <Detail label="Data">{formatPlanData(plan.dataBytes)}</Detail>
            <Detail label="Validity">{plan.validityDays} days</Detail>
            <Detail label="Supplier cost per GB">{plan.costPerMb ? `${formatPerGb(plan.costPerMb.min)}–${formatPerGb(plan.costPerMb.max)}` : "—"}</Detail>
            <Detail label={plan.holdOverride ? "Hold (override)" : "Hold at default markup"}>{formatMoney(plan.holdOverride ?? plan.defaultHold)}</Detail>
            <Detail label="Sold">
              {plan.soldCount} · {plan.resellerPlans} reseller plan{plan.resellerPlans === 1 ? "" : "s"}
            </Detail>
          </dl>
        </GlassCard>
      )}
      <DataTable
        rows={plan ? rows : undefined}
        loading={!plan}
        columns={columns}
        rowKey={(n) => n.id}
        defaultSort={{ id: "cost" }}
        caption="Networks in this plan's zone"
        toolbar={<SearchInput value={q} onChange={setQ} placeholder="Search country or network" />}
      />
      {plan ? <PlanFormDialog open={editing} onOpenChange={setEditing} plan={plan} /> : null}
    </div>
  );
}
