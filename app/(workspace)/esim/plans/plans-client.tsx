"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/platform/data-table";
import { DemoZoneChip, FilterSelect, SearchInput } from "@/components/platform/fields";
import { PlanFormDialog } from "@/components/platform/plan-dialogs";
import { PageHeader } from "@/components/platform/primitives";
import { StatusChip } from "@/components/platform/status-chip";
import { usePermission } from "@/hooks/use-permission";
import { useResource } from "@/hooks/use-resource";
import { catalogueApi } from "@/lib/api/catalogue";
import { formatMoney, formatPerGb } from "@/lib/platform/money";
import { PLAN_STATUS } from "@/lib/platform/status-labels";
import type { Plan } from "@/lib/platform/types";
import { formatPlanData } from "@/lib/platform/units";

/** Plans (spec 8.10): admin creates and edits; staff see them read-only (backend: admin only). */
export function PlansClient() {
  const router = useRouter();
  const { me, rules } = usePermission();
  const canEdit = rules.canEditPlans(me);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Plan["status"] | null>(null);
  const { data, loading, error } = useResource(() => catalogueApi.listPlans({ q, status }), [q, status]);
  const [editing, setEditing] = useState<Plan | null | undefined>(undefined);

  const columns: Column<Plan>[] = [
    {
      id: "name",
      header: "Plan",
      cell: (p) => <span className="font-medium">{p.name}</span>,
      sortValue: (p) => p.name,
      hideable: false,
    },
    {
      id: "zone",
      header: "Zone",
      cell: (p) => (
        <span className="flex items-center gap-2">
          {p.zoneName}
          {p.demoZone ? <DemoZoneChip /> : null}
        </span>
      ),
      sortValue: (p) => p.zoneName,
    },
    { id: "data", header: "Data", align: "right", cell: (p) => formatPlanData(p.dataBytes), sortValue: (p) => p.dataBytes },
    { id: "days", header: "Validity", align: "right", cell: (p) => `${p.validityDays} days`, sortValue: (p) => p.validityDays },
    {
      id: "cost",
      header: "Supplier cost per GB",
      align: "right",
      cell: (p) =>
        p.costPerMb ? (
          <span>
            {formatPerGb(p.costPerMb.min)}–{formatPerGb(p.costPerMb.max)}
            {p.spreadRatio && p.spreadRatio > 3 ? <span className="ml-1.5 text-small text-warning">{p.spreadRatio.toFixed(0)}×</span> : null}
          </span>
        ) : (
          "—"
        ),
      sortValue: (p) => p.costPerMb?.typical ?? null,
    },
    {
      id: "hold",
      header: "Hold",
      align: "right",
      cell: (p) => (
        <span>
          {formatMoney(p.holdOverride ?? p.defaultHold)}
          {p.holdOverride ? <span className="ml-1.5 text-small text-fg-3">override</span> : null}
        </span>
      ),
      sortValue: (p) => Number(p.holdOverride ?? p.defaultHold),
    },
    { id: "status", header: "Status", cell: (p) => <StatusChip status={PLAN_STATUS[p.status]} />, sortValue: (p) => p.status },
    { id: "sold", header: "Sold", align: "right", cell: (p) => p.soldCount, sortValue: (p) => p.soldCount },
    ...(canEdit
      ? [
          {
            id: "actions",
            header: "",
            hideable: false,
            align: "right" as const,
            cell: (p: Plan) => (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Edit ${p.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(p);
                }}
              >
                <Pencil strokeWidth={1.5} />
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Plans"
        description="Plans resellers and your team can sell. Each is a data amount on a zone; usage is billed per MB at the network's price."
        actions={
          canEdit ? (
            <Button onClick={() => setEditing(null)}>
              <Plus strokeWidth={1.75} />
              Create plan
            </Button>
          ) : null
        }
      />
      <DataTable
        rows={data}
        loading={loading}
        error={error}
        columns={columns}
        rowKey={(p) => p.id}
        onRowClick={(p) => router.push(`/esim/plans/${p.id}`)}
        defaultSort={{ id: "sold", desc: true }}
        caption="Plans"
        toolbar={
          <>
            <SearchInput value={q} onChange={setQ} placeholder="Search plans" />
            <FilterSelect label="Status" value={status} onChange={setStatus} all="All statuses" options={[{ value: "active", label: "Active" }, { value: "draft", label: "Draft" }, { value: "inactive", label: "Inactive" }]} />
          </>
        }
        empty={{ title: "No plans match", description: "Try another search or status.", action: canEdit ? <Button onClick={() => setEditing(null)}>Create plan</Button> : undefined }}
      />
      <PlanFormDialog open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)} plan={editing ?? null} />
    </div>
  );
}
