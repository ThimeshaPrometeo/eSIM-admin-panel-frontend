"use client";

import { FitPage } from "@/components/platform/fit-page";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DataTable, type Column } from "@/components/platform/data-table";
import { FilterSelect, ResellerSelect } from "@/components/platform/fields";
import { PageHeader } from "@/components/platform/primitives";
import { StatusChip } from "@/components/platform/status-chip";
import { usePermission } from "@/hooks/use-permission";
import { useResource } from "@/hooks/use-resource";
import { esimsApi } from "@/lib/api/esims";
import { formatDateTime, formatRelative } from "@/lib/platform/dates";
import { formatMoney, toNumber } from "@/lib/platform/money";
import { ORDER_STATUS, type OrderStatus } from "@/lib/platform/status";
import type { Order } from "@/lib/platform/types";

/** Orders (spec 8.6): new eSIMs and added plans, with their outcome. */
export function OrdersClient() {
  const router = useRouter();
  const { isTenant } = usePermission();
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [type, setType] = useState<Order["type"] | null>(null);
  const [resellerId, setResellerId] = useState<string | null>(null);
  const { data, loading, error } = useResource(() => esimsApi.listOrders({ status, type, resellerId }), [status, type, resellerId]);
  const columns: Column<Order>[] = [
    { id: "when", header: "Created", cell: (o) => <span title={formatDateTime(o.createdAt)}>{formatRelative(o.createdAt)}</span>, sortValue: (o) => o.createdAt, hideable: false },
    { id: "type", header: "Type", cell: (o) => (o.type === "new_esim" ? "New eSIM" : "Add plan"), sortValue: (o) => o.type },
    {
      id: "esim",
      header: "eSIM",
      cell: (o) =>
        o.esimId && o.iccid ? (
          <Link href={`/esim/esims/${o.esimId}`} onClick={(e) => e.stopPropagation()} className="font-mono text-small hover:text-primary">
            …{o.iccid.slice(-8)}
          </Link>
        ) : (
          <span className="text-fg-3">—</span>
        ),
    },
    { id: "plan", header: "Plan", cell: (o) => o.planName, sortValue: (o) => o.planName },
    ...(isTenant ? [{ id: "reseller", header: "Reseller", cell: (o: Order) => o.resellerName ?? <span className="text-fg-2">Direct</span>, sortValue: (o: Order) => o.resellerName ?? "" }] : []),
    { id: "user", header: "By", cell: (o) => <span className="text-fg-2">{o.userName}</span>, sortValue: (o) => o.userName },
    { id: "hold", header: "Hold", align: "right", cell: (o) => formatMoney(o.holdAmount), sortValue: (o) => toNumber(o.holdAmount) },
    { id: "status", header: "Status", cell: (o) => <StatusChip status={ORDER_STATUS[o.status]} />, sortValue: (o) => o.status },
  ];
  return (
    <FitPage>
      <PageHeader title="Orders" description="Every sale and added plan. “Being verified” means the supplier didn't answer; don't sell again while it's checked." />
      <DataTable
        rows={data}
        loading={loading}
        error={error}
        columns={columns}
        rowKey={(o) => o.id}
        onRowClick={(o) => router.push(`/esim/orders/${o.id}`)}
        pageSize={20}
        caption="Orders"
        toolbar={
          <>
            <FilterSelect label="Status" value={status} onChange={setStatus} all="Any status" options={(Object.keys(ORDER_STATUS) as OrderStatus[]).map((s) => ({ value: s, label: ORDER_STATUS[s].label }))} />
            <FilterSelect label="Type" value={type} onChange={setType} all="Any type" options={[{ value: "new_esim", label: "New eSIM" }, { value: "add_plan", label: "Add plan" }]} className="sm:w-40" />
            {isTenant ? <ResellerSelect value={resellerId} onChange={setResellerId} /> : null}
          </>
        }
        empty={{ title: "No orders match", description: "Try another filter.", illustration: "sim" }}
      />
    </FitPage>
  );
}
