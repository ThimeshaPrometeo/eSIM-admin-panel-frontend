"use client";

import Link from "next/link";
import type { Column } from "./data-table";
import { StatusChip } from "./status-chip";
import { UsageBar } from "./usage";
import { formatDate, formatRelative } from "@/lib/platform/dates";
import { esimStatus, installStatus, PLAN_STATE } from "@/lib/platform/status";
import type { Esim } from "@/lib/platform/types";
import { isLive } from "@/lib/platform/plan-state";
import { formatBytes, formatPlanData } from "@/lib/platform/units";

/** eSIM list columns (spec 8.2); `reseller` only for admin/staff. */
export function esimColumns({ reseller }: { reseller: boolean }): Column<Esim>[] {
  return [
    {
      id: "iccid",
      header: "ICCID",
      cell: (e) => (
        <Link href={`/esim/esims/${e.id}`} onClick={(ev) => ev.stopPropagation()} className="font-mono text-small tabular hover:text-primary">
          {e.iccid}
        </Link>
      ),
      sortValue: (e) => e.iccid,
      hideable: false,
    },
    { id: "status", header: "Status", cell: (e) => <StatusChip status={esimStatus(e.status, e.suspendedBy)} />, sortValue: (e) => e.status },
    { id: "install", header: "Install", cell: (e) => <StatusChip status={installStatus(e.installStatus, e.installStatusRaw)} />, sortValue: (e) => e.installStatus, defaultHidden: true },
    {
      id: "plan",
      header: "Current plan",
      cell: (e) => {
        const live = e.plans.filter((p) => isLive(p.state));
        const p = live[0] ?? e.plans[0];
        if (!p) return <span className="text-fg-3">—</span>;
        return (
          <span className="flex flex-col gap-1">
            <span className="text-body">
              {p.name}
              {live.length > 1 ? <span className="text-fg-3"> +{live.length - 1}</span> : null}
            </span>
            {p.state !== "active" ? <StatusChip status={PLAN_STATE[p.state]} className="h-5 self-start text-[11px]" /> : null}
          </span>
        );
      },
      sortValue: (e) => e.plans[0]?.name ?? "",
    },
    {
      id: "usage",
      header: "Data used",
      cell: (e) =>
        e.limitBytes ? (
          <span className="flex w-32 flex-col gap-1.5">
            <span className="text-small text-fg-2 tabular">
              {formatBytes(e.usedBytes)} of {formatPlanData(e.limitBytes)}
            </span>
            <UsageBar used={e.usedBytes} limit={e.limitBytes} />
          </span>
        ) : (
          <span className="text-fg-3">—</span>
        ),
      sortValue: (e) => (e.limitBytes ? e.usedBytes / e.limitBytes : -1),
    },
    { id: "expiry", header: "Expires", cell: (e) => formatDate(e.expiresAt), sortValue: (e) => e.expiresAt ?? "", defaultHidden: true },
    { id: "customer", header: "Customer", cell: (e) => e.customerName ?? <span className="text-fg-3">—</span>, sortValue: (e) => e.customerName ?? "", className: "whitespace-normal min-w-28" },
    ...(reseller ? [{ id: "reseller", header: "Reseller", cell: (e: Esim) => e.resellerName ?? <span className="text-fg-2">Direct</span>, sortValue: (e: Esim) => e.resellerName ?? "" }] : []),
    { id: "activity", header: "Last activity", cell: (e) => <span className="text-fg-2">{formatRelative(e.lastActivityAt)}</span>, sortValue: (e) => e.lastActivityAt ?? "", defaultHidden: true },
  ];
}
