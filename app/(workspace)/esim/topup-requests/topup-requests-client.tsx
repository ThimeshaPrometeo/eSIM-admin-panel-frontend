"use client";

import { FitPage } from "@/components/platform/fit-page";
import Link from "next/link";
import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/platform/confirm-dialog";
import { DataTable, type Column } from "@/components/platform/data-table";
import { PageHeader } from "@/components/platform/primitives";
import { StatusChip } from "@/components/platform/status-chip";
import { useAction } from "@/hooks/use-action";
import { usePermission } from "@/hooks/use-permission";
import { useResource } from "@/hooks/use-resource";
import { walletsApi } from "@/lib/api/wallets";
import { formatDateTime, formatRelative } from "@/lib/platform/dates";
import { formatMoney, toNumber } from "@/lib/platform/money";
import { TOPUP_STATUS } from "@/lib/platform/status";
import type { TopupRequest } from "@/lib/platform/types";

/** Top-up requests (spec 8.21): approve credits the wallet, pays the outstanding amount first and funds waiting plans. */
export function TopupRequestsClient() {
  const { me, rules } = usePermission();
  const canDecide = rules.canApproveTopups(me);
  const [status, setStatus] = useState<TopupRequest["status"] | "all">("pending");
  const { data, loading, error } = useResource(() => walletsApi.listTopupRequests({ status: status === "all" ? null : status }), [status]);
  const wallets = useResource(() => walletsApi.listWallets(), ["wallets"]);
  const [approving, setApproving] = useState<TopupRequest | null>(null);
  const [rejecting, setRejecting] = useState<TopupRequest | null>(null);
  const { run } = useAction();

  const walletOf = (t: TopupRequest) => wallets.data?.find((w) => w.id === t.walletId);
  const columns: Column<TopupRequest>[] = [
    {
      id: "reseller",
      header: "Reseller",
      cell: (t) => (
        <Link href={`/esim/resellers/${t.resellerId}`} className="font-medium hover:text-primary">
          {t.resellerName}
        </Link>
      ),
      sortValue: (t) => t.resellerName,
      hideable: false,
    },
    { id: "amount", header: "Amount", align: "right", cell: (t) => <span className="font-medium">{formatMoney(t.amount)}</span>, sortValue: (t) => toNumber(t.amount) },
    { id: "ref", header: "Bank reference", cell: (t) => <span className="font-mono text-small">{t.paymentReference || "—"}</span> },
    { id: "note", header: "Note", cell: (t) => <span className="text-fg-2">{t.note || "—"}</span>, defaultHidden: true },
    { id: "by", header: "Requested by", cell: (t) => t.requestedBy },
    { id: "when", header: "Requested", cell: (t) => <span title={formatDateTime(t.createdAt)}>{formatRelative(t.createdAt)}</span>, sortValue: (t) => t.createdAt },
    {
      id: "status",
      header: "Status",
      cell: (t) => (
        <span className="flex flex-col gap-1">
          <StatusChip status={TOPUP_STATUS[t.status]} />
          {t.receiptNumber ? <span className="font-mono text-small text-fg-3">{t.receiptNumber}</span> : null}
          {t.decisionNote ? <span className="text-small text-fg-3">{t.decisionNote}</span> : null}
        </span>
      ),
      sortValue: (t) => t.status,
    },
    ...(canDecide
      ? [
          {
            id: "actions",
            header: "",
            align: "right" as const,
            hideable: false,
            cell: (t: TopupRequest) =>
              t.status === "pending" ? (
                <span className="inline-flex gap-1">
                  <Button size="sm" onClick={() => setApproving(t)}>
                    <Check strokeWidth={1.75} />
                    Approve
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setRejecting(t)}>
                    <X strokeWidth={1.5} />
                    Reject
                  </Button>
                </span>
              ) : null,
          },
        ]
      : []),
  ];

  const w = approving ? walletOf(approving) : undefined;
  return (
    <FitPage>
      <PageHeader title="Top-up requests" description="Resellers request a top-up after a bank transfer. Approving adds the money to their wallet, pays any outstanding amount first and starts plans waiting for funds." />
      <Tabs value={status} onValueChange={(v) => setStatus(v as typeof status)}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>
      <DataTable rows={data} loading={loading} error={error} columns={columns} rowKey={(t) => t.id} caption="Top-up requests" empty={{ title: status === "pending" ? "Nothing to approve" : "No requests", description: "New requests appear here and in your notifications.", illustration: "signal" }} />
      <ConfirmDialog
        open={!!approving}
        onOpenChange={(o) => !o && setApproving(null)}
        title={`Approve ${formatMoney(approving?.amount ?? 0)} for ${approving?.resellerName ?? ""}?`}
        description={
          w ? (
            <span className="flex flex-col gap-1">
              <span>Only approve once the transfer {approving?.paymentReference ? `(${approving.paymentReference}) ` : ""}is in the bank account.</span>
              {toNumber(w.outstanding) > 0 ? <span>{formatMoney(w.outstanding)} outstanding is paid first.</span> : null}
              {w.waitingPlans ? <span>{w.waitingPlans} plan{w.waitingPlans > 1 ? "s" : ""} waiting for {formatMoney(w.waitingAmount)} are funded oldest first, as far as the money goes.</span> : null}
              <span>A receipt is issued.</span>
            </span>
          ) : (
            "The money is added to the wallet and a receipt is issued."
          )
        }
        confirmLabel="Approve top-up"
        onConfirm={async () => {
          await run(() => walletsApi.approveTopupRequest(approving!.id), {
            success: "Top-up approved",
            description: (t) =>
              [t.receiptNumber ? `Receipt ${t.receiptNumber}.` : "", t.effect && toNumber(t.effect.outstandingPaid) > 0 ? `${formatMoney(t.effect.outstandingPaid)} paid the outstanding amount.` : "", t.effect?.plansFunded ? `${t.effect.plansFunded} waiting plan${t.effect.plansFunded > 1 ? "s" : ""} funded.` : ""]
                .filter(Boolean)
                .join(" "),
          });
          setApproving(null);
        }}
      />
      <ConfirmDialog
        open={!!rejecting}
        onOpenChange={(o) => !o && setRejecting(null)}
        title={`Reject ${formatMoney(rejecting?.amount ?? 0)} for ${rejecting?.resellerName ?? ""}?`}
        description="The reseller sees your reason."
        confirmLabel="Reject top-up"
        destructive
        requireReason
        onConfirm={async ({ reason }) => {
          await run(() => walletsApi.rejectTopupRequest(rejecting!.id, { decisionNote: reason ?? "" }), { success: "Top-up rejected" });
          setRejecting(null);
        }}
      />
    </FitPage>
  );
}
