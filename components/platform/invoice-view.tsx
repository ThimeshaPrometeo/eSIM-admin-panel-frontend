"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePlatform } from "@/contexts/platform-context";
import { useResource } from "@/hooks/use-resource";
import { logDownload } from "@/lib/api/audit";
import { errorMessage } from "@/lib/api/errors";
import { financeApi, type ChargeQuery } from "@/lib/api/finance";
import { exportPdf } from "@/lib/exports";
import { formatDate } from "@/lib/platform/dates";
import { formatMoney } from "@/lib/platform/money";
import type { InvoiceDetail, InvoiceSummary } from "@/lib/platform/types";
import { ChargeBreakdownSheet } from "./charge-breakdown";
import { EstimatedChip } from "./status-chip";

const KIND_LABEL = { statement: "Statement", receipt: "Receipt", invoice: "Invoice" } as const;

/** PDF of a document, with the "Downloaded by" watermark (spec 8.22); downloads are audit-logged. */
export async function downloadInvoicePdf(d: InvoiceDetail, who: { fullName: string; username: string }) {
  const rows: { a: string; b: string; c: string; d: string }[] =
    d.kind === "statement"
      ? [
          ...d.usage.map((u) => ({ a: formatDate(u.date), b: `Usage: ${u.planName}${u.estimated ? " (estimated)" : ""}`, c: `${u.mb.toLocaleString("en-GB", { maximumFractionDigits: 1 })} MB`, d: (-u.amount).toFixed(2) })),
          ...d.topups.map((t) => ({ a: formatDate(t.date), b: `Top-up ${t.reference}`, c: "", d: t.amount.toFixed(2) })),
          ...d.releases.map((r) => ({ a: formatDate(r.date), b: `Hold released: ${r.planName}`, c: "", d: `(${r.amount.toFixed(2)})` })),
          { a: "", b: "Opening balance", c: "", d: d.totals.opening.toFixed(2) },
          { a: "", b: "Top-ups", c: "", d: d.totals.topups.toFixed(2) },
          { a: "", b: "Usage charges", c: "", d: (-d.totals.usage).toFixed(2) },
          ...(d.totals.other ? [{ a: "", b: "Other movements", c: "", d: d.totals.other.toFixed(2) }] : []),
          { a: "", b: "Closing balance", c: "", d: d.totals.closing.toFixed(2) },
        ]
      : d.lines.map((l) => ({ a: formatDate(d.issuedAt), b: l.label, c: "", d: l.amount.toFixed(2) }));
  await exportPdf({
    fileName: `${d.number}.pdf`,
    title: `${KIND_LABEL[d.kind]} ${d.number}`,
    subtitle: `${d.resellerName ?? "Direct sale"}${d.period ? ` · ${d.title.replace("Statement, ", "")}` : ""} · issued ${formatDate(d.issuedAt)} · EUR · ${d.taxWording}`,
    columns: [
      { header: "Date", value: (r: (typeof rows)[number]) => r.a },
      { header: "Description", value: (r: (typeof rows)[number]) => r.b },
      { header: "Data", value: (r: (typeof rows)[number]) => r.c },
      { header: "Amount (EUR)", value: (r: (typeof rows)[number]) => r.d },
    ],
    rows,
    watermark: who,
    watermarkOn: d.watermark,
  });
  await logDownload(d.kind, d.number);
}

/** A document in a side sheet: statement lines per plan per day (each opens its charge breakdown), top-ups, released holds. */
export function InvoiceSheet({ doc, onOpenChange }: { doc: InvoiceSummary | null; onOpenChange: (o: boolean) => void }) {
  const { me } = usePlatform();
  const { data } = useResource(() => financeApi.getInvoice(doc!.id), [doc?.id], !!doc);
  const [explain, setExplain] = useState<ChargeQuery | null>(null);
  const walletId = doc?.resellerId ? `w-${doc.resellerId}` : null;
  return (
    <>
      <Sheet open={!!doc} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[min(760px,96vw)] overflow-y-auto">
          <SheetTitle>
            {doc ? `${KIND_LABEL[doc.kind]} ${doc.number}` : ""}
          </SheetTitle>
          {!data ? (
            <Skeleton className="h-72" />
          ) : (
            <div className="flex flex-col gap-5">
              <SheetDescription>
                {data.title} · {data.resellerName ?? "Direct sale"} · issued {formatDate(data.issuedAt)}
              </SheetDescription>
              {data.kind === "statement" ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <Total label="Opening balance" value={formatMoney(data.totals.opening)} />
                    <Total label="+ Top-ups" value={formatMoney(data.totals.topups)} />
                    <Total label="− Usage charges" value={formatMoney(data.totals.usage)} />
                    <Total label="= Closing balance" value={formatMoney(data.totals.closing)} strong />
                  </div>
                  <p className="text-small text-fg-2">
                    {data.totals.other ? `Other movements (adjustments) ${formatMoney(data.totals.other)}. ` : ""}
                    Usage is charged per MB used, at the price of the network the phone was on. Each line is one plan on one day; open it to see the networks and rates
                    behind it.{data.totals.releases ? ` Holds of ${formatMoney(data.totals.releases)} were released unused this month; they were never charged.` : ""}
                  </p>
                  <div className="glass-card overflow-hidden">
                    <Table containerClassName="max-h-[46dvh]">
                      <TableHeader>
                        <tr>
                          <TableHead>Day</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead className="text-right">Data</TableHead>
                          <TableHead className="text-right">Charge</TableHead>
                        </tr>
                      </TableHeader>
                      <TableBody>
                        {data.usage.map((u, i) => (
                          <TableRow key={i} className="cursor-pointer" onClick={() => walletId && setExplain({ walletId, date: u.date })}>
                            <TableCell className="text-fg-2">{formatDate(u.date)}</TableCell>
                            <TableCell>
                              <span className="flex items-center gap-2">
                                {u.planName}
                                {u.estimated ? <EstimatedChip className="h-5 text-[11px]" /> : null}
                              </span>
                            </TableCell>
                            <TableCell className="text-right tabular">{u.mb.toLocaleString("en-GB", { maximumFractionDigits: 1 })} MB</TableCell>
                            <TableCell className="text-right font-medium tabular">{formatMoney(u.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {data.topups.length ? (
                    <ul className="flex flex-col gap-1 text-body">
                      {data.topups.map((t) => (
                        <li key={t.reference} className="flex justify-between">
                          <span>
                            {formatDate(t.date)} · Top-up <span className="font-mono text-small">{t.reference}</span>
                          </span>
                          <span className="tabular text-accent">+{formatMoney(t.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : (
                <div className="glass-card flex flex-col gap-2 p-5">
                  {data.lines.map((l) => (
                    <p key={l.label} className="flex justify-between text-body">
                      <span>{l.label}</span>
                      <span className="font-medium tabular">{formatMoney(l.amount)}</span>
                    </p>
                  ))}
                </div>
              )}
              <p className="text-small text-fg-3">{data.taxWording}</p>
              <Button
                className="self-start"
                onClick={async () => {
                  if (!me) return;
                  try {
                    await downloadInvoicePdf(data, me);
                    toast.success("PDF downloaded");
                  } catch (e) {
                    toast.error(errorMessage(e));
                  }
                }}
              >
                <FileDown strokeWidth={1.5} />
                Download PDF
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
      <ChargeBreakdownSheet query={explain} onOpenChange={(o) => !o && setExplain(null)} />
    </>
  );
}

function Total({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`glass-card flex flex-col gap-1 p-4 ${strong ? "!border-[color-mix(in_oklab,var(--primary)_45%,transparent)]" : ""}`}>
      <span className="text-small text-fg-3">{label}</span>
      <span className="text-section font-semibold tabular">{value}</span>
    </div>
  );
}
