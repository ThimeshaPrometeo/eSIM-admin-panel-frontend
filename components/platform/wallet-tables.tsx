"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { DataTable, type Column } from "./data-table";
import { EstimatedChip, StatusChip } from "./status-chip";
import { formatDateTime } from "@/lib/platform/dates";
import { formatMoney, formatSignedMoney, toNumber } from "@/lib/platform/money";
import { HOLD_STATUS } from "@/lib/platform/status";
import type { LedgerEntry, LedgerType, WalletHold } from "@/lib/platform/types";
import { cn } from "@/lib/utils";

export const LEDGER_TYPE: Record<LedgerType, string> = {
  topup: "Top-up",
  usage_charge: "Usage charge",
  usage_reprice: "Usage repriced",
  hold: "Hold",
  hold_release: "Hold release",
  adjustment: "Adjustment",
  outstanding_recovery: "Outstanding payment",
  deposit: "Deposit",
};

/** Holds (spec 8.18, 8.19): plan, eSIM, amount, used, status; waiting ones in funding order. */
export function HoldsTable({ rows, loading, toolbar, empty }: { rows: WalletHold[] | undefined; loading?: boolean; toolbar?: ReactNode; empty?: string }) {
  const columns: Column<WalletHold>[] = [
    {
      id: "queue",
      header: "Queue",
      align: "right",
      cell: (h) => (h.queuePosition ? <span className="inline-grid size-6 place-items-center rounded-full border border-[color-mix(in_oklab,var(--warning)_45%,transparent)] text-small tabular">{h.queuePosition}</span> : <span className="text-fg-3">—</span>),
      sortValue: (h) => h.queuePosition ?? 999,
      hideable: false,
    },
    { id: "plan", header: "Plan", cell: (h) => <span className="font-medium">{h.planName}</span>, sortValue: (h) => h.planName },
    {
      id: "esim",
      header: "eSIM",
      cell: (h) => (
        <Link href={`/esim/esims/${h.esimId}`} className="font-mono text-small hover:text-primary" onClick={(e) => e.stopPropagation()}>
          …{h.iccid.slice(-8)}
        </Link>
      ),
    },
    { id: "amount", header: "Hold", align: "right", cell: (h) => formatMoney(h.amount), sortValue: (h) => toNumber(h.amount) },
    {
      id: "used",
      header: "Used",
      align: "right",
      cell: (h) => {
        const pct = toNumber(h.amount) ? toNumber(h.used) / toNumber(h.amount) : 0;
        return (
          <span>
            {formatMoney(h.used)} <span className="text-small text-fg-3">{Math.round(pct * 100)}%</span>
          </span>
        );
      },
      sortValue: (h) => toNumber(h.used),
    },
    { id: "status", header: "Status", cell: (h) => <StatusChip status={HOLD_STATUS[h.status]} />, sortValue: (h) => h.status },
    { id: "since", header: "Since", cell: (h) => <span className="text-fg-2">{formatDateTime(h.createdAt)}</span>, sortValue: (h) => h.createdAt },
  ];
  return (
    <DataTable
      rows={rows}
      loading={loading}
      columns={columns}
      rowKey={(h) => h.id}
      toolbar={toolbar}
      pageSize={10}
      caption="Holds"
      empty={{ title: empty ?? "No holds", description: "Holds appear when a plan is sold or added.", illustration: "sim" }}
    />
  );
}

/** Ledger rows (spec 8.18, 8.20): type, amount, balance after, reference, estimated/final for usage. */
export function ledgerColumns({ wallet, onExplain }: { wallet: boolean; onExplain?: (l: LedgerEntry) => void }): Column<LedgerEntry>[] {
  return [
    { id: "date", header: "Date", cell: (l) => <span className="text-fg-2">{formatDateTime(l.createdAt)}</span>, sortValue: (l) => l.createdAt, hideable: false },
    ...(wallet ? [{ id: "wallet", header: "Wallet", cell: (l: LedgerEntry) => l.walletName, sortValue: (l: LedgerEntry) => l.walletName }] : []),
    {
      id: "type",
      header: "Type",
      cell: (l) => (
        <span className="flex flex-wrap items-center gap-2">
          {LEDGER_TYPE[l.type]}
          {l.estimated ? <EstimatedChip className="h-5 text-[11px]" /> : null}
          {onExplain && l.type === "usage_charge" ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExplain(l);
              }}
              className="text-small font-medium text-primary underline-offset-4 hover:underline"
            >
              How was this charged?
            </button>
          ) : null}
        </span>
      ),
      sortValue: (l) => l.type,
    },
    { id: "desc", header: "Description", cell: (l) => <span className="text-fg-2">{l.description}</span>, defaultHidden: true },
    {
      id: "amount",
      header: "Amount",
      align: "right",
      cell: (l) => (
        <span className={cn("font-medium", l.type === "hold" || l.type === "hold_release" ? "text-fg-3" : toNumber(l.amount) > 0 ? "text-accent" : "")}>
          {formatSignedMoney(l.amount)}
        </span>
      ),
      sortValue: (l) => toNumber(l.amount),
    },
    { id: "balance", header: "Balance after", align: "right", cell: (l) => formatMoney(l.balanceAfter), sortValue: (l) => toNumber(l.balanceAfter) },
    { id: "ref", header: "Reference", cell: (l) => <span className="font-mono text-small text-fg-2">{l.reference}</span>, sortValue: (l) => l.reference },
  ];
}
