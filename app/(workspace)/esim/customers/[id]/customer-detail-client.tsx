"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Mail, Pencil, Phone, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomerDialog } from "@/components/platform/customer-dialog";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Detail } from "@/components/platform/fields";
import { FitPage } from "@/components/platform/fit-page";
import { GlassCard } from "@/components/platform/glass-card";
import { EmptyState } from "@/components/platform/primitives";
import { StatusChip } from "@/components/platform/status-chip";
import { usePermission } from "@/hooks/use-permission";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/errors";
import { operationsApi } from "@/lib/api/operations";
import { formatDate, formatRelative } from "@/lib/platform/dates";
import { esimStatus } from "@/lib/platform/status";
import type { CustomerDetail } from "@/lib/platform/types";

type Row = CustomerDetail["esims"][number];

/** A customer and their eSIMs (spec 8.16). */
export function CustomerDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const { me, can, isTenant, rules } = usePermission();
  const { data: c, error } = useResource(() => operationsApi.getCustomer(id), [id]);
  const [editing, setEditing] = useState(false);

  if (error)
    return (
      <EmptyState
        illustration="signal"
        title="Customer not found"
        description={errorMessage(error)}
        action={
          <Button asChild variant="secondary">
            <Link href="/esim/customers">Back to customers</Link>
          </Button>
        }
      />
    );

  const columns: Column<Row>[] = [
    { id: "iccid", header: "eSIM", hideable: false, cell: (e) => <span className="font-mono text-small">{e.iccid}</span>, sortValue: (e) => e.iccid },
    { id: "status", header: "Status", cell: (e) => <StatusChip status={esimStatus(e.status, e.suspendedBy)} />, sortValue: (e) => e.status },
    { id: "plan", header: "Current plan", cell: (e) => e.planName ?? <span className="text-fg-3">No plan</span>, sortValue: (e) => e.planName ?? "" },
    { id: "activity", header: "Last activity", cell: (e) => <span className="text-fg-2">{e.lastActivityAt ? formatRelative(e.lastActivityAt) : "Never"}</span>, sortValue: (e) => e.lastActivityAt ?? "" },
  ];

  return (
    <FitPage>
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href="/esim/customers">
          <ArrowLeft strokeWidth={1.5} />
          Customers
        </Link>
      </Button>
      {!c ? (
        <Skeleton className="h-36" />
      ) : (
        <GlassCard className="shrink-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-title font-semibold">{c.name}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-body text-fg-2">
                {c.email ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="size-4" strokeWidth={1.5} />
                    {c.email}
                  </span>
                ) : null}
                {c.phone ? (
                  <span className="inline-flex items-center gap-1.5 tabular">
                    <Phone className="size-4" strokeWidth={1.5} />
                    {c.phone}
                  </span>
                ) : null}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {can("sell_esim", "manage") ? (
                <Button asChild>
                  <Link href={`/esim/sell?customer=${c.id}`}>
                    <ShoppingBag strokeWidth={1.5} />
                    Sell eSIM
                  </Link>
                </Button>
              ) : null}
              {rules.canManageCustomers(me) ? (
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  <Pencil strokeWidth={1.5} />
                  Edit
                </Button>
              ) : null}
            </div>
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-4">
            {isTenant ? <Detail label="Reseller">{c.resellerId ? <Link href={`/esim/resellers/${c.resellerId}`} className="hover:text-primary">{c.resellerName}</Link> : "Direct customer"}</Detail> : null}
            <Detail label="eSIMs">
              <span className="tabular">{c.esimCount}</span>
            </Detail>
            <Detail label="Active eSIMs">
              <span className="tabular">{c.esims.filter((e) => e.status === "ACTIVE").length}</span>
            </Detail>
            <Detail label="Customer since">{formatDate(c.createdAt)}</Detail>
          </dl>
        </GlassCard>
      )}
      <DataTable
        rows={c?.esims}
        loading={!c}
        columns={columns}
        rowKey={(e) => e.id}
        onRowClick={(e) => router.push(`/esim/esims/${e.id}`)}
        caption="eSIMs"
        empty={{ title: "No eSIMs yet", description: "Sell an eSIM to this customer to see it here.", illustration: "sim" }}
      />
      {c ? <CustomerDialog open={editing} customer={c} onOpenChange={setEditing} /> : null}
    </FitPage>
  );
}
