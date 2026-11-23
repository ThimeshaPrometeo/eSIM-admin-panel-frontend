"use client";

import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useResource } from "@/hooks/use-resource";
import { financeApi, type ChargeQuery } from "@/lib/api/finance";
import { countryFlag } from "@/lib/platform/coverage";
import { formatDate } from "@/lib/platform/dates";
import { formatMoney, formatPerMb } from "@/lib/platform/money";
import type { ChargeBreakdown } from "@/lib/platform/types";
import { formatBytes } from "@/lib/platform/units";
import { cn } from "@/lib/utils";
import { EstimatedChip, StatusChip } from "./status-chip";

/** Precise small euro amounts (line charges are fractions of a cent per MB). */
function eur4(n: number) {
  return `€${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

/**
 * "How was this charged?" (spec 8.32): every network line of a usage charge
 * with the Yesim rate, our cost, markup, discount, the charge and profit
 * (admin/staff), estimated or final, and the price list version. Resellers see
 * only their own price and charge.
 */
export function ChargeBreakdownSheet({ query, onOpenChange }: { query: ChargeQuery | null; onOpenChange: (o: boolean) => void }) {
  const { data } = useResource(() => financeApi.getChargeBreakdown(query!), [query], !!query);
  return (
    <Sheet open={!!query} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[min(1120px,96vw)] overflow-y-auto">
        <SheetTitle>How was this charged?</SheetTitle>
        {!data ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-6 w-60" />
            <Skeleton className="h-28" />
            <Skeleton className="h-64" />
          </div>
        ) : (
          <ChargeBreakdownBody data={data} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function ChargeBreakdownBody({ data }: { data: ChargeBreakdown }) {
  const tenant = data.viewer === "tenant";
  const totalMb = data.lines.reduce((a, l) => a + l.mb, 0);
  const versions = [...new Set(data.lines.map((l) => l.version))].sort();
  // one day (a ledger or statement line): the day is in the title, not in every row
  const manyDays = new Set(data.lines.map((l) => l.date)).size > 1;
  return (
    <div className="flex flex-col gap-5">
      <SheetDescription>
        {data.title} · {data.subtitle}
      </SheetDescription>

      <div className={cn("grid gap-3", tenant ? "sm:grid-cols-4" : "sm:grid-cols-2")}>
        <Figure label="Data" value={formatBytes(totalMb * 1048576)} />
        {tenant ? <Figure label="Yesim cost" value={formatMoney(data.totalCost)} /> : null}
        {data.direct && tenant ? (
          <Figure label="Retail price (revenue)" value={formatMoney(data.totalRevenue)} strong />
        ) : (
          <Figure label={tenant ? "Charged to the wallet" : "Charged"} value={formatMoney(data.total)} strong />
        )}
        {tenant ? <Figure label="Profit" value={formatMoney(data.totalProfit)} tone={(data.totalProfit ?? 0) >= 0 ? "text-accent" : "text-danger"} /> : null}
      </div>

      <div className="rounded-control border border-border bg-surface-2/60 p-4 text-small text-fg-2">
        {tenant ? (
          <>
            Each line: <span className="font-mono text-fg">MB × Yesim €/MB × (1 + markup) × (1 − discount)</span>, with the rates in force that day. A plan&apos;s
            charge for a day is its lines added up and rounded to the cent once. Direct sales are charged to the house wallet at Yesim cost; their revenue is the
            retail price.
          </>
        ) : (
          <>
            Each line: <span className="font-mono text-fg">MB × your price per MB</span> on the network the phone used that day. A plan&apos;s charge for a day is
            its lines added up and rounded to the cent once.
          </>
        )}{" "}
        Price list version{versions.length > 1 ? "s" : ""} {versions.join(", ")}.{" "}
        {data.estimated ? "Estimated lines become final with the supplier's nightly report." : "All lines are final."}
      </div>

      {data.lines.length === 0 ? (
        <p className="text-body text-fg-3">No usage in this period.</p>
      ) : (
        <div className="glass-card overflow-hidden">
          <Table containerClassName="max-h-[calc(100dvh-19rem)]">
            <TableHeader>
              <tr>
                {manyDays ? <TableHead>Day</TableHead> : null}
                <TableHead className="min-w-44">Network</TableHead>
                <TableHead className="text-right">Data</TableHead>
                {tenant ? (
                  <>
                    <TableHead className="text-right">Yesim €/MB</TableHead>
                    <TableHead className="text-right">Our cost</TableHead>
                    <TableHead className="text-right">{data.direct ? "Retail markup" : "Markup · discount"}</TableHead>
                  </>
                ) : null}
                <TableHead className="text-right">{data.direct ? "Retail €/MB" : tenant ? "Price €/MB" : "Your €/MB"}</TableHead>
                <TableHead className="text-right">{data.direct ? "Retail" : "Charge"}</TableHead>
                {tenant ? <TableHead className="text-right">Profit</TableHead> : null}
                <TableHead>Status</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {data.lines.map((l, i) => (
                <TableRow key={`${l.date}-${l.networkId}-${l.iccid}-${i}`}>
                  {manyDays ? <TableCell className="text-fg-2">{formatDate(l.date)}</TableCell> : null}
                  <TableCell className="min-w-44 whitespace-normal">
                    <span className="flex flex-col">
                      <span>
                        {countryFlag(l.iso2)} {l.operator}
                      </span>
                      <span className="text-small text-fg-3">
                        {l.planName} · …{l.iccid.slice(-6)} · v{l.version}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular">{l.mb.toLocaleString("en-GB", { maximumFractionDigits: 1 })} MB</TableCell>
                  {tenant ? (
                    <>
                      <TableCell className="text-right tabular">{formatPerMb(l.costPerMb)}</TableCell>
                      <TableCell className="text-right tabular">{eur4(l.cost ?? 0)}</TableCell>
                      <TableCell className="text-right tabular">
                        {l.markupPercent}%{l.discountPercent ? <span className="text-fg-3"> · −{l.discountPercent}%</span> : null}
                      </TableCell>
                    </>
                  ) : null}
                  <TableCell className="text-right tabular">{formatPerMb(data.direct && l.revenue !== null ? l.revenue / Math.max(l.mb, 1e-9) : l.pricePerMb)}</TableCell>
                  <TableCell className="text-right font-medium tabular">{eur4(data.direct && l.revenue !== null ? l.revenue : l.charge)}</TableCell>
                  {tenant ? <TableCell className="text-right tabular text-accent">{eur4(l.profit ?? 0)}</TableCell> : null}
                  <TableCell>{l.estimated ? <EstimatedChip className="h-5 text-[11px]" /> : <StatusChip status={{ label: "Final", tone: "positive" }} className="h-5 text-[11px]" />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Figure({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className="glass-card flex flex-col gap-1 p-4">
      <span className="text-small text-fg-3">{label}</span>
      <span className={cn("tabular", strong ? "text-section font-semibold" : "text-body font-medium", tone)}>{value}</span>
    </div>
  );
}
