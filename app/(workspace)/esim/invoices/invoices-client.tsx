"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/platform/data-table";
import { FilterSelect, ResellerSelect } from "@/components/platform/fields";
import { FitPage } from "@/components/platform/fit-page";
import { downloadInvoicePdf, InvoiceSheet } from "@/components/platform/invoice-view";
import { PageHeader } from "@/components/platform/primitives";
import { usePlatform } from "@/contexts/platform-context";
import { usePermission } from "@/hooks/use-permission";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/errors";
import { financeApi } from "@/lib/api/finance";
import { formatDate } from "@/lib/platform/dates";
import { formatMoney, toNumber } from "@/lib/platform/money";
import type { InvoiceKind, InvoiceSummary } from "@/lib/platform/types";

const KIND: Record<InvoiceKind, string> = { statement: "Statement", receipt: "Top-up receipt", invoice: "Direct-sale invoice" };

/** Invoices (spec 8.22): statements, receipts and direct-sale invoices; sequential numbers; watermarked PDFs. */
export function InvoicesClient() {
  const { me } = usePlatform();
  const { isTenant } = usePermission();
  const [kind, setKind] = useState<InvoiceKind | null>(null);
  const [resellerId, setResellerId] = useState<string | null>(null);
  const { data, loading, error } = useResource(() => financeApi.listInvoices({ kind, resellerId }), [kind, resellerId]);
  const [open, setOpen] = useState<InvoiceSummary | null>(null);

  const download = async (d: InvoiceSummary) => {
    if (!me) return;
    try {
      await downloadInvoicePdf(await financeApi.getInvoice(d.id), me);
      toast.success("PDF downloaded");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const columns: Column<InvoiceSummary>[] = [
    { id: "number", header: "Number", cell: (d) => <span className="font-mono text-small">{d.number}</span>, sortValue: (d) => d.number, hideable: false },
    { id: "kind", header: "Type", cell: (d) => KIND[d.kind], sortValue: (d) => d.kind },
    { id: "title", header: "Document", cell: (d) => d.title, className: "whitespace-normal min-w-40" },
    ...(isTenant ? [{ id: "reseller", header: "Reseller", cell: (d: InvoiceSummary) => d.resellerName ?? <span className="text-fg-2">Direct sale</span>, sortValue: (d: InvoiceSummary) => d.resellerName ?? "" }] : []),
    { id: "amount", header: "Amount", align: "right", cell: (d) => <span className="font-medium">{formatMoney(d.amount)}</span>, sortValue: (d) => toNumber(d.amount) },
    { id: "issued", header: "Issued", cell: (d) => formatDate(d.issuedAt), sortValue: (d) => d.issuedAt },
    {
      id: "pdf",
      header: "",
      align: "right",
      hideable: false,
      cell: (d) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            void download(d);
          }}
        >
          <FileDown strokeWidth={1.5} />
          PDF
        </Button>
      ),
    },
  ];

  return (
    <FitPage>
      <PageHeader
        title="Invoices"
        description={
          isTenant
            ? "Monthly statements per reseller (per-MB usage charges per plan per day, top-ups, released holds), top-up receipts and direct-sale invoices. Numbers run in order per type and year; issued documents never change."
            : "Your monthly statements and top-up receipts. Every PDF carries a “Downloaded by” watermark."
        }
      />
      <DataTable
        rows={data}
        loading={loading}
        error={error}
        columns={columns}
        rowKey={(d) => d.id}
        onRowClick={setOpen}
        defaultSort={{ id: "issued", desc: true }}
        caption="Invoices"
        toolbar={
          <>
            <FilterSelect label="Type" value={kind} onChange={setKind} all="All documents" options={(Object.keys(KIND) as InvoiceKind[]).filter((k) => isTenant || k !== "invoice").map((k) => ({ value: k, label: KIND[k] }))} />
            {isTenant ? <ResellerSelect value={resellerId} onChange={setResellerId} all="Everyone" /> : null}
          </>
        }
        empty={{ title: "No documents", description: "Statements are issued on the first of each month; receipts when a top-up is approved." }}
      />
      <InvoiceSheet doc={open} onOpenChange={(o) => !o && setOpen(null)} />
    </FitPage>
  );
}
