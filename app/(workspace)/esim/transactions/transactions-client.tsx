"use client";

import { FitPage } from "@/components/platform/fit-page";
import { useMemo, useState } from "react";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/platform/data-table";
import { FilterSelect, PeriodSelect, ResellerSelect } from "@/components/platform/fields";
import { PageHeader } from "@/components/platform/primitives";
import { LEDGER_TYPE, ledgerColumns } from "@/components/platform/wallet-tables";
import { usePermission } from "@/hooks/use-permission";
import { useResource } from "@/hooks/use-resource";
import { logDownload } from "@/lib/api/audit";
import { walletsApi } from "@/lib/api/wallets";
import type { ChargeQuery } from "@/lib/api/finance";
import { ChargeBreakdownSheet } from "@/components/platform/charge-breakdown";
import { exportCsv } from "@/lib/exports";
import { periodFor, type Period } from "@/lib/platform/period";
import type { LedgerEntry, LedgerType } from "@/lib/platform/types";

/** Transactions (spec 8.20): the ledger across the viewer's scope. */
export function TransactionsClient() {
  const { isTenant } = usePermission();
  const [period, setPeriod] = useState<Period>(() => periodFor("30d"));
  const [type, setType] = useState<LedgerType | null>(null);
  const [resellerId, setResellerId] = useState<string | null>(null);
  const { data, loading, error } = useResource(() => walletsApi.listTransactions({ from: period.from, to: period.to, type, resellerId, pageSize: 100000 }), [period.from, period.to, type, resellerId]);
  const rows = data?.data;
  const [explain, setExplain] = useState<ChargeQuery | null>(null);
  // a usage charge row is one wallet's charges for one day (reference UC-YYYY-MM-DD)
  const columns = useMemo(() => ledgerColumns({ wallet: isTenant, onExplain: (l) => setExplain({ walletId: l.walletId, date: l.reference.slice(3) }) }), [isTenant]);
  return (
    <FitPage>
      <PageHeader title="Transactions" description="Every movement of money: top-ups, usage charges, holds and their release, adjustments. Usage stays Estimated until the nightly report." />
      <DataTable
        rows={rows}
        loading={loading}
        error={error}
        columns={columns}
        rowKey={(l) => l.id}
        pageSize={25}
        caption="Transactions"
        toolbar={
          <>
            <PeriodSelect value={period} onChange={setPeriod} />
            <FilterSelect label="Type" value={type} onChange={setType} all="All types" options={(Object.keys(LEDGER_TYPE) as LedgerType[]).map((t) => ({ value: t, label: LEDGER_TYPE[t] }))} />
            {isTenant ? <ResellerSelect value={resellerId} onChange={setResellerId} /> : null}
          </>
        }
        actions={
          <Button
            variant="secondary"
            size="sm"
            disabled={!rows?.length}
            onClick={async () => {
              exportCsv<LedgerEntry>(
                `transactions-${period.from}-${period.to}.csv`,
                [
                  { header: "Date", value: (l) => l.createdAt },
                  { header: "Wallet", value: (l) => l.walletName },
                  { header: "Type", value: (l) => LEDGER_TYPE[l.type] },
                  { header: "Amount (EUR)", value: (l) => Number(l.amount) },
                  { header: "Balance after (EUR)", value: (l) => Number(l.balanceAfter) },
                  { header: "Reference", value: (l) => l.reference },
                  { header: "Status", value: (l) => (l.estimated === null ? "" : l.estimated ? "Estimated" : "Final") },
                  { header: "Description", value: (l) => l.description },
                ],
                rows ?? [],
              );
              await logDownload("transactions", "csv");
              toast.success("CSV downloaded");
            }}
          >
            <FileDown strokeWidth={1.5} />
            CSV
          </Button>
        }
        empty={{ title: "No transactions in this period", description: "Try a longer period or another type.", illustration: "signal" }}
      />
      <ChargeBreakdownSheet query={explain} onOpenChange={(o) => !o && setExplain(null)} />
    </FitPage>
  );
}
