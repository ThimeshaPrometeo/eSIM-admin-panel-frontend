"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/platform/data-table";
import { FilterSelect, SearchInput } from "@/components/platform/fields";
import { PageHeader } from "@/components/platform/primitives";
import { CreateResellerForm } from "@/components/platform/reseller-dialogs";
import { StatusChip } from "@/components/platform/status-chip";
import { usePermission } from "@/hooks/use-permission";
import { useResource } from "@/hooks/use-resource";
import { peopleApi } from "@/lib/api/people";
import { formatMoney, toNumber } from "@/lib/platform/money";
import { RESELLER_STATUS } from "@/lib/platform/status-labels";
import type { Reseller } from "@/lib/platform/types";

/** Resellers (spec 8.15): markup is shown to admins (and staff read-only), never to resellers. */
export function ResellersClient() {
  const router = useRouter();
  const { me, rules } = usePermission();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"active" | "suspended" | null>(null);
  const { data, loading, error } = useResource(() => peopleApi.listResellers({ q, status }), [q, status]);
  const [creating, setCreating] = useState(false);
  const showMarkup = rules.canSeeMarkup(me);

  const columns: Column<Reseller>[] = [
    {
      id: "company",
      header: "Company",
      cell: (r) => (
        <span className="flex flex-col">
          <span className="font-medium">{r.companyName}</span>
          <span className="text-small text-fg-3">{r.contactName}</span>
        </span>
      ),
      sortValue: (r) => r.companyName,
      hideable: false,
    },
    { id: "status", header: "Status", cell: (r) => <StatusChip status={RESELLER_STATUS[r.status]} />, sortValue: (r) => r.status },
    ...(showMarkup ? [{ id: "markup", header: "Markup", align: "right" as const, cell: (r: Reseller) => `${r.markupPercent}%`, sortValue: (r: Reseller) => r.markupPercent }] : []),
    { id: "discount", header: "Discount", align: "right", cell: (r) => (r.discountPercent ? `${r.discountPercent}%` : <span className="text-fg-3">—</span>), sortValue: (r) => r.discountPercent ?? 0 },
    { id: "available", header: "Available", align: "right", cell: (r) => <span className={toNumber(r.wallet.available) < 50 ? "text-warning" : ""}>{formatMoney(r.wallet.available)}</span>, sortValue: (r) => toNumber(r.wallet.available) },
    { id: "held", header: "Held", align: "right", cell: (r) => formatMoney(r.wallet.reserved), sortValue: (r) => toNumber(r.wallet.reserved) },
    {
      id: "outstanding",
      header: "Outstanding",
      align: "right",
      cell: (r) => (toNumber(r.wallet.outstanding) > 0 ? <span className="font-medium text-danger">{formatMoney(r.wallet.outstanding)}</span> : <span className="text-fg-3">—</span>),
      sortValue: (r) => toNumber(r.wallet.outstanding),
    },
    { id: "waiting", header: "Waiting plans", align: "right", cell: (r) => r.wallet.waitingPlans || <span className="text-fg-3">—</span>, sortValue: (r) => r.wallet.waitingPlans, defaultHidden: true },
    { id: "esims", header: "eSIMs", align: "right", cell: (r) => r.esimCount, sortValue: (r) => r.esimCount },
    { id: "assistants", header: "Assistants", align: "right", cell: (r) => r.assistantCount, sortValue: (r) => r.assistantCount },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Resellers"
        description="Businesses that sell your eSIMs. They pay per MB at the supplier price plus their markup, less any discount."
        actions={
          rules.canManageResellers(me) ? (
            <Button onClick={() => setCreating(true)}>
              <Plus strokeWidth={1.75} />
              Create reseller
            </Button>
          ) : null
        }
      />
      <DataTable
        rows={data}
        loading={loading}
        error={error}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={(r) => router.push(`/esim/resellers/${r.id}`)}
        defaultSort={{ id: "esims", desc: true }}
        caption="Resellers"
        toolbar={
          <>
            <SearchInput value={q} onChange={setQ} placeholder="Search company or contact" />
            <FilterSelect label="Status" value={status} onChange={setStatus} all="All statuses" options={[{ value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }]} />
          </>
        }
        empty={{ title: "No resellers match", description: "Try another search or status.", illustration: "signal" }}
      />
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-2xl">
          {creating ? (
            <CreateResellerForm
              onDone={(r) => {
                setCreating(false);
                if (r) router.push(`/esim/resellers/${r.id}`);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
