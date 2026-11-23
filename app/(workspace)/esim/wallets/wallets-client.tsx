"use client";

import { FitPage } from "@/components/platform/fit-page";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/platform/data-table";
import { PageHeader } from "@/components/platform/primitives";
import { StatusChip } from "@/components/platform/status-chip";
import { useResource } from "@/hooks/use-resource";
import { walletsApi } from "@/lib/api/wallets";
import { formatMoney, toNumber } from "@/lib/platform/money";
import { RESELLER_STATUS } from "@/lib/platform/status-labels";
import type { Wallet } from "@/lib/platform/types";

/** Wallets (spec 8.18): every wallet including the house wallet. */
export function WalletsClient() {
  const router = useRouter();
  const { data, loading, error } = useResource(() => walletsApi.listWallets(), ["wallets"]);
  const columns: Column<Wallet>[] = [
    {
      id: "name",
      header: "Wallet",
      cell: (w) => (
        <span className="flex items-center gap-2">
          <span className="font-medium">{w.name}</span>
          {w.kind === "house" ? <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-fg-2">Direct sales</span> : null}
        </span>
      ),
      sortValue: (w) => (w.kind === "house" ? "" : w.name),
      hideable: false,
    },
    { id: "status", header: "Status", cell: (w) => (w.kind === "house" ? <span className="text-fg-3">—</span> : <StatusChip status={RESELLER_STATUS[w.status]} />) },
    { id: "available", header: "Available", align: "right", cell: (w) => <span className={w.lowBalance ? "font-medium text-warning" : "font-medium"}>{formatMoney(w.available)}</span>, sortValue: (w) => toNumber(w.available) },
    { id: "balance", header: "Balance", align: "right", cell: (w) => formatMoney(w.balance), sortValue: (w) => toNumber(w.balance) },
    { id: "held", header: "Held", align: "right", cell: (w) => formatMoney(w.reserved), sortValue: (w) => toNumber(w.reserved) },
    { id: "outstanding", header: "Outstanding", align: "right", cell: (w) => (toNumber(w.outstanding) > 0 ? <span className="font-medium text-danger">{formatMoney(w.outstanding)}</span> : <span className="text-fg-3">—</span>), sortValue: (w) => toNumber(w.outstanding) },
    { id: "waiting", header: "Waiting plans", align: "right", cell: (w) => (w.waitingPlans ? `${w.waitingPlans} · ${formatMoney(w.waitingAmount)}` : <span className="text-fg-3">—</span>), sortValue: (w) => w.waitingPlans },
  ];
  return (
    <FitPage>
      <PageHeader title="Wallets" description="Every reseller wallet and the house wallet for direct sales. No wallet can go negative." />
      <DataTable rows={data} loading={loading} error={error} columns={columns} rowKey={(w) => w.id} onRowClick={(w) => router.push(`/esim/wallets/${w.id}`)} defaultSort={{ id: "name" }} caption="Wallets" />
    </FitPage>
  );
}
