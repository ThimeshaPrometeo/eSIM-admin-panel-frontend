"use client";

import { FitPage, FitScroll } from "@/components/platform/fit-page";
import { useState } from "react";
import { ChevronDown, FileDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/platform/confirm-dialog";
import { DataTable, type Column } from "@/components/platform/data-table";
import { GlassCard } from "@/components/platform/glass-card";
import { PageHeader } from "@/components/platform/primitives";
import { StatusChip } from "@/components/platform/status-chip";
import { TopupRequestForm } from "@/components/platform/topup-dialog";
import { WalletSummary } from "@/components/platform/wallet-summary";
import { HoldsTable } from "@/components/platform/wallet-tables";
import { usePlatform } from "@/contexts/platform-context";
import { useAction } from "@/hooks/use-action";
import { usePermission } from "@/hooks/use-permission";
import { useResource } from "@/hooks/use-resource";
import { logDownload } from "@/lib/api/audit";
import { errorMessage } from "@/lib/api/errors";
import { walletsApi } from "@/lib/api/wallets";
import { exportPdf } from "@/lib/exports";
import { formatDate, formatDateTime, formatRelative } from "@/lib/platform/dates";
import { formatMoney, toNumber } from "@/lib/platform/money";
import { TOPUP_STATUS } from "@/lib/platform/status";
import type { TopupRequest } from "@/lib/platform/types";

/** Wallet (spec 8.19), for resellers and assistants. */
export function WalletClient() {
  const { me } = usePlatform();
  const { rules, can } = usePermission();
  const wallet = useResource(() => walletsApi.getMyWallet(), ["my-wallet"]);
  const holds = useResource(() => walletsApi.listWalletHolds(wallet.data!.id, "live"), [wallet.data?.id], !!wallet.data);
  const requests = useResource(() => walletsApi.listTopupRequests(), ["my-topups"], can("topup_requests") || can("wallets"));
  const [requesting, setRequesting] = useState(false);
  const [cancelling, setCancelling] = useState<TopupRequest | null>(null);
  const [howOpen, setHowOpen] = useState(false);
  const { run } = useAction();
  const canRequest = rules.canRequestTopup(me);

  const waiting = (holds.data ?? []).filter((h) => h.status === "waiting");
  const running = (holds.data ?? []).filter((h) => h.status !== "waiting");

  const receipt = async (t: TopupRequest) => {
    if (!me) return;
    try {
      await exportPdf({
        fileName: `${t.receiptNumber}.pdf`,
        title: `Top-up receipt ${t.receiptNumber}`,
        subtitle: `${t.resellerName} · approved ${formatDateTime(t.decidedAt)} · demo document`,
        columns: [
          { header: "Receipt", value: (x: TopupRequest) => x.receiptNumber },
          { header: "Bank reference", value: (x: TopupRequest) => x.paymentReference || "—" },
          { header: "Requested", value: (x: TopupRequest) => formatDate(x.createdAt) },
          { header: "Approved", value: (x: TopupRequest) => formatDate(x.decidedAt) },
          { header: "Amount (EUR)", value: (x: TopupRequest) => Number(x.amount).toFixed(2) },
        ],
        rows: [t],
        watermark: { fullName: me.fullName, username: me.username },
      });
      await logDownload("receipt", t.receiptNumber ?? t.id);
      toast.success("Receipt downloaded");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const reqColumns: Column<TopupRequest>[] = [
    { id: "when", header: "Requested", cell: (t) => <span title={formatDateTime(t.createdAt)}>{formatRelative(t.createdAt)}</span>, sortValue: (t) => t.createdAt, hideable: false },
    { id: "amount", header: "Amount", align: "right", cell: (t) => <span className="font-medium">{formatMoney(t.amount)}</span>, sortValue: (t) => toNumber(t.amount) },
    { id: "ref", header: "Bank reference", cell: (t) => <span className="font-mono text-small">{t.paymentReference || "—"}</span> },
    {
      id: "status",
      header: "Status",
      cell: (t) => (
        <span className="flex flex-col gap-1">
          <StatusChip status={TOPUP_STATUS[t.status]} />
          {t.decisionNote ? <span className="text-small text-fg-3">{t.decisionNote}</span> : null}
          {t.effect && (toNumber(t.effect.outstandingPaid) > 0 || t.effect.plansFunded) ? (
            <span className="text-small text-fg-3">
              {toNumber(t.effect.outstandingPaid) > 0 ? `${formatMoney(t.effect.outstandingPaid)} paid outstanding. ` : ""}
              {t.effect.plansFunded ? `${t.effect.plansFunded} plan${t.effect.plansFunded > 1 ? "s" : ""} funded.` : ""}
            </span>
          ) : null}
        </span>
      ),
      sortValue: (t) => t.status,
    },
    { id: "by", header: "By", cell: (t) => <span className="text-fg-2">{t.requestedBy}</span>, defaultHidden: true },
    {
      id: "actions",
      header: "",
      align: "right",
      hideable: false,
      cell: (t) =>
        t.status === "approved" && t.receiptNumber ? (
          <Button variant="ghost" size="sm" onClick={() => receipt(t)}>
            <FileDown strokeWidth={1.5} />
            Receipt
          </Button>
        ) : t.status === "pending" && canRequest ? (
          <Button variant="ghost" size="sm" onClick={() => setCancelling(t)}>
            Cancel request
          </Button>
        ) : null,
    },
  ];

  return (
    <FitPage>
      <PageHeader
        title="Wallet"
        description={me?.resellerName ? `${me.resellerName}. Plans are paid from here, per MB used.` : undefined}
        actions={
          canRequest && wallet.data ? (
            <Button onClick={() => setRequesting(true)}>
              <Plus strokeWidth={1.75} />
              Request top-up
            </Button>
          ) : null
        }
      />
      {!wallet.data ? <Skeleton className="h-36" /> : <WalletSummary wallet={wallet.data} />}
<FitScroll>
      {wallet.data && toNumber(wallet.data.outstanding) > 0 ? (
        <p role="alert" className="rounded-control border border-[color-mix(in_oklab,var(--danger)_40%,transparent)] bg-[color-mix(in_oklab,var(--danger)_8%,transparent)] px-4 py-3 text-body">
          {formatMoney(wallet.data.outstanding)} of usage wasn&apos;t covered by your wallet (for example a price rise while a plan was running). New plans can&apos;t be ordered until it&apos;s paid; your next top-up pays it first.
        </p>
      ) : null}

      {waiting.length ? (
        <section>
          <h2 className="mb-1 text-section font-semibold">Waiting for funds</h2>
          <p className="mb-3 text-small text-fg-2">In funding order. A top-up funds them oldest first; one that doesn&apos;t fit is skipped for the next that does.</p>
          <HoldsTable rows={waiting} />
        </section>
      ) : null}
      <section>
        <h2 className="mb-3 text-section font-semibold">Holds on running plans</h2>
        <HoldsTable rows={holds.data ? running : undefined} loading={holds.loading} empty="No running plans" />
      </section>
      <section>
        <h2 className="mb-3 text-section font-semibold">Top-up requests</h2>
        <DataTable rows={requests.data} loading={requests.loading} columns={reqColumns} rowKey={(t) => t.id} pageSize={8} caption="Top-up requests" empty={{ title: "No requests yet", description: "Request a top-up after you transfer money.", illustration: "signal" }} />
      </section>

      <GlassCard className="!p-0">
        <button className="flex w-full items-center justify-between px-6 py-4 text-left" onClick={() => setHowOpen((o) => !o)} aria-expanded={howOpen}>
          <span className="text-section font-semibold">How holds and per-MB charging work</span>
          <ChevronDown className={`size-5 text-fg-3 transition-transform duration-500 ${howOpen ? "rotate-180" : ""}`} strokeWidth={1.5} />
        </button>
        {howOpen ? (
          <div className="grid gap-4 border-t border-border px-6 py-5 text-body text-fg-2 md:grid-cols-2">
            <p>
              <span className="font-medium text-fg">You pay for data used.</span> Each MB is charged at your price for the network the phone is on, so the same plan can cost less in one country than another.
            </p>
            <p>
              <span className="font-medium text-fg">A hold reserves the most a plan can cost.</span> When you sell a plan, its maximum cost (all its data on the dearest network) is set aside. Usage is charged from it; what&apos;s left is released when the plan ends.
            </p>
            <p>
              <span className="font-medium text-fg">Not enough available?</span> A new eSIM is still created but blocked until funded; an added plan waits. Plans are funded oldest first when you top up.
            </p>
            <p>
              <span className="font-medium text-fg">Estimated, then final.</span> Usage is charged every 15 minutes as an estimate, then made exact each night from the supplier&apos;s report.
            </p>
          </div>
        ) : null}
      </GlassCard>

      {wallet.data ? (
        <Dialog open={requesting} onOpenChange={setRequesting}>
          <DialogContent>{requesting ? <TopupRequestForm wallet={wallet.data} onDone={() => setRequesting(false)} /> : null}</DialogContent>
        </Dialog>
      ) : null}
      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(o) => !o && setCancelling(null)}
        title="Cancel this request?"
        description={`The request for ${formatMoney(cancelling?.amount ?? 0)} is withdrawn. You can send a new one any time.`}
        confirmLabel="Cancel request"
        destructive
        onConfirm={async () => {
          await run(() => walletsApi.cancelTopupRequest(cancelling!.id), { success: "Request cancelled" });
          setCancelling(null);
        }}
      />
      </FitScroll>
    </FitPage>
  );
}
