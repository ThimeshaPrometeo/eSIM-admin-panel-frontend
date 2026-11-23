"use client";

import { FitPage, FitScroll } from "@/components/platform/fit-page";
import Link from "next/link";
import { useId, useState } from "react";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/platform/data-table";
import { EmptyState, PageHeader } from "@/components/platform/primitives";
import { WalletSummary } from "@/components/platform/wallet-summary";
import { HoldsTable, ledgerColumns } from "@/components/platform/wallet-tables";
import { useAction } from "@/hooks/use-action";
import { usePermission } from "@/hooks/use-permission";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/errors";
import { walletsApi } from "@/lib/api/wallets";
import type { ChargeQuery } from "@/lib/api/finance";
import { ChargeBreakdownSheet } from "@/components/platform/charge-breakdown";
import { formatMoney } from "@/lib/platform/money";
import type { Wallet } from "@/lib/platform/types";

/** Wallet detail (spec 8.18): ledger, holds, manual credit or adjustment (admin, reason required). */
export function WalletDetailClient({ id }: { id: string }) {
  const { me, rules } = usePermission();
  const wallet = useResource(() => walletsApi.getWallet(id), [id]);
  const holds = useResource(() => walletsApi.listWalletHolds(id), [id]);
  const ledger = useResource(() => walletsApi.listTransactions({ walletId: id, pageSize: 100 }), [id]);
  const [adjusting, setAdjusting] = useState(false);
  const [explain, setExplain] = useState<ChargeQuery | null>(null);
  if (wallet.error) return <EmptyState illustration="signal" title="Wallet not found" description={errorMessage(wallet.error)} />;
  const w = wallet.data;
  return (
    <FitPage>
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href="/esim/wallets">
          <ArrowLeft strokeWidth={1.5} />
          Wallets
        </Link>
      </Button>
      <PageHeader
        title={w?.name ?? "Wallet"}
        description={w?.kind === "house" ? "Pays for direct sales at supplier cost." : w?.resellerId ? undefined : undefined}
        actions={
          <>
            {w?.resellerId ? (
              <Button asChild variant="secondary">
                <Link href={`/esim/resellers/${w.resellerId}`}>Open reseller</Link>
              </Button>
            ) : null}
            {rules.canAdjustWallet(me) && w ? (
              <Button onClick={() => setAdjusting(true)}>
                <SlidersHorizontal strokeWidth={1.5} />
                {w.kind === "house" ? "Deposit or adjust" : "Credit or adjust"}
              </Button>
            ) : null}
          </>
        }
      />
      {!w ? <Skeleton className="h-36" /> : <WalletSummary wallet={w} />}
<FitScroll>
      <section>
        <h2 className="mb-3 text-section font-semibold">Holds</h2>
        <HoldsTable rows={holds.data} loading={holds.loading} />
      </section>
      <section>
        <h2 className="mb-3 text-section font-semibold">Ledger</h2>
        <DataTable rows={ledger.data?.data} loading={ledger.loading} columns={ledgerColumns({ wallet: false, onExplain: (l) => setExplain({ walletId: l.walletId, date: l.reference.slice(3) }) })} rowKey={(l) => l.id} pageSize={15} caption="Ledger" empty={{ title: "No transactions", description: "Top-ups and usage charges appear here." }} />
      </section>
      <ChargeBreakdownSheet query={explain} onOpenChange={(o) => !o && setExplain(null)} />
      {w ? (
        <Dialog open={adjusting} onOpenChange={setAdjusting}>
          <DialogContent>{adjusting ? <AdjustForm wallet={w} onDone={() => setAdjusting(false)} /> : null}</DialogContent>
        </Dialog>
      ) : null}
      </FitScroll>
    </FitPage>
  );
}

function AdjustForm({ wallet, onDone }: { wallet: Wallet; onDone: () => void }) {
  const id = useId();
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const { run, pending } = useAction();
  const n = Number(amount);
  return (
    <>
      <DialogHeader>
        <DialogTitle>{wallet.kind === "house" ? "Deposit or adjust" : "Credit or adjust"}</DialogTitle>
        <DialogDescription>
          A credit pays any outstanding amount first, then funds waiting plans. A debit can&apos;t take the wallet below what&apos;s held ({formatMoney(wallet.reserved)}).
        </DialogDescription>
      </DialogHeader>
      <div role="radiogroup" aria-label="Direction" className="mb-4 inline-flex rounded-full border border-border p-1">
        {(["credit", "debit"] as const).map((d) => (
          <button key={d} role="radio" aria-checked={direction === d} onClick={() => setDirection(d)} className={`h-8 rounded-full px-4 text-small font-medium ${direction === d ? "bg-surface-3 text-fg" : "text-fg-2"}`}>
            {d === "credit" ? (wallet.kind === "house" ? "Deposit" : "Credit") : "Debit"}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-a`} label="Amount (EUR)">
          <Input id={`${id}-a`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
        </Field>
        <Field id={`${id}-d`} label="Description (kept in the audit log)">
          <Input id={`${id}-d`} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!(n > 0) || description.trim().length < 3 || pending}
          onClick={async () => {
            const r = await run(() => walletsApi.createWalletAdjustment(wallet.id, { direction, amount: n, description }), {
              success: direction === "credit" ? "Wallet credited" : "Wallet adjusted",
              description: (e) => (e.plansFunded ? `${e.plansFunded} waiting plan${e.plansFunded > 1 ? "s" : ""} funded.` : undefined),
            });
            if (r.ok) onDone();
          }}
        >
          {direction === "credit" ? "Credit wallet" : "Debit wallet"}
        </Button>
      </DialogFooter>
    </>
  );
}
