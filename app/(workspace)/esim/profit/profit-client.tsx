"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartFill } from "@/components/platform/charts/chart-kit";
import { RevenueProfitChart, WaterfallChart } from "@/components/platform/charts/charts";
import { DataTable, type Column } from "@/components/platform/data-table";
import { FilterSelect, PeriodSelect } from "@/components/platform/fields";
import { FitPage, FitScroll, useFit } from "@/components/platform/fit-page";
import { GlassCard } from "@/components/platform/glass-card";
import { PageHeader, StatBlock } from "@/components/platform/primitives";
import { usePlatform } from "@/contexts/platform-context";
import { useResource } from "@/hooks/use-resource";
import { logDownload } from "@/lib/api/audit";
import { errorMessage } from "@/lib/api/errors";
import { financeApi } from "@/lib/api/finance";
import { peopleApi } from "@/lib/api/people";
import { exportCsv, exportPdf } from "@/lib/exports";
import { formatAxisDate, formatDate, formatDateTime } from "@/lib/platform/dates";
import { formatMoney } from "@/lib/platform/money";
import { periodFor, PERIOD_LABELS, type Period } from "@/lib/platform/period";
import type { ProfitReport, ProfitRow } from "@/lib/platform/types";
import { formatBytes } from "@/lib/platform/units";
import { cn } from "@/lib/utils";

const pct = (n: number) => `${n.toLocaleString("en-GB", { maximumFractionDigits: 1 })}%`;
type By = "byReseller" | "byCountry" | "byNetwork" | "byPlan";
const BY_LABEL: Record<By, string> = { byReseller: "Reseller", byCountry: "Country", byNetwork: "Network", byPlan: "Plan" };

/** Profit and costs (spec 8.23, 8.32): admin full, staff view. */
export function ProfitClient() {
  const { me } = usePlatform();
  const [period, setPeriod] = useState<Period>(() => ({ ...periodFor("30d"), granularity: "day" }));
  const [resellerId, setResellerId] = useState<string | null>(null);
  const resellers = useResource(() => peopleApi.listResellerOptions(), ["reseller-options"]);
  const { data } = useResource(() => financeApi.getProfitReport(period, { resellerId }), [period.from, period.to, period.granularity, resellerId]);
  const params = useSearchParams();
  const [tab, setTab] = useState(() => (["breakdown", "reconciliation"].includes(params.get("tab") ?? "") ? params.get("tab")! : "overview"));
  const [by, setBy] = useState<By>("byReseller");

  const label = (b: string) => formatAxisDate(b.length === 4 ? `${b}-01-01` : b.length === 7 ? `${b}-01` : b, period.granularity);
  const rowsFor = (k: By) => data?.[k] ?? [];

  const exportRows = async (kind: "csv" | "pdf") => {
    if (!data || !me) return;
    const rows = rowsFor(by);
    const cols = [
      { header: BY_LABEL[by], value: (r: ProfitRow) => r.label },
      { header: "Data (GB)", value: (r: ProfitRow) => Math.round((r.mb / 1024) * 100) / 100 },
      { header: "Revenue (EUR)", value: (r: ProfitRow) => r.revenue },
      { header: "Yesim cost (EUR)", value: (r: ProfitRow) => r.cost },
      { header: "Profit (EUR)", value: (r: ProfitRow) => r.profit },
      { header: "Margin %", value: (r: ProfitRow) => Math.round(r.marginPercent * 10) / 10 },
    ];
    const name = `profit-${BY_LABEL[by].toLowerCase()}-${period.from}-${period.to}`;
    try {
      if (kind === "csv") exportCsv(`${name}.csv`, cols, rows);
      else
        await exportPdf({
          fileName: `${name}.pdf`,
          title: `Profit and costs by ${BY_LABEL[by].toLowerCase()}`,
          subtitle: `${formatDate(period.from)} to ${formatDate(period.to)} · revenue ${formatMoney(data.totals.revenue)}, Yesim cost ${formatMoney(data.totals.cost)}, profit ${formatMoney(data.totals.profit)} (${pct(data.totals.marginPercent)})`,
          columns: cols,
          rows,
          watermark: { fullName: me.fullName, username: me.username },
        });
      await logDownload("profit_report", kind);
      toast.success(kind === "csv" ? "CSV downloaded" : "PDF downloaded");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <FitPage>
      <PageHeader
        title="Profit and costs"
        description="Revenue (reseller charges and direct sales) against Yesim's cost, from the same per-MB lines that charge the wallets."
        actions={
          <>
            <Button variant="secondary" size="sm" disabled={!data} onClick={() => exportRows("csv")}>
              <FileDown strokeWidth={1.5} />
              CSV
            </Button>
            <Button variant="secondary" size="sm" disabled={!data} onClick={() => exportRows("pdf")}>
              <FileDown strokeWidth={1.5} />
              PDF
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <PeriodSelect value={period} onChange={setPeriod} />
        <FilterSelect
          label="Reseller"
          value={resellerId}
          onChange={setResellerId}
          all="Everyone"
          options={[...(resellers.data ?? []).map((r) => ({ value: r.id, label: r.name })), { value: "direct", label: "Direct sales" }]}
        />
      </div>
      <GlassCard className="grid shrink-0 grid-cols-2 gap-6 sm:grid-cols-5">
        <StatBlock size="sm" label="Revenue" value={data?.totals.revenue ?? 0} format={formatMoney} loading={!data} hint={data && data.totals.estimatedRevenue > 0 ? `${formatMoney(data.totals.estimatedRevenue)} estimated` : undefined} />
        <StatBlock size="sm" label="Yesim cost" value={data?.totals.cost ?? 0} format={formatMoney} loading={!data} />
        <StatBlock size="sm" label="Profit" value={data?.totals.profit ?? 0} format={formatMoney} loading={!data} />
        <StatBlock size="sm" label="Margin" value={data?.totals.marginPercent ?? 0} format={pct} loading={!data} />
        <StatBlock size="sm" label="Data" value={data ? data.totals.mb * 1048576 : 0} format={(n) => formatBytes(n)} loading={!data} />
      </GlassCard>

      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="self-start">
          <TabsTrigger value="overview">Over time</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
          <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
        </TabsList>
        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          {!data ? null : tab === "overview" ? (
            <OverviewCharts
              series={data.series.map((x) => ({ label: label(x.bucket), revenue: x.revenue, cost: x.cost, profit: x.profit }))}
              waterfall={data.waterfall}
              subtitle={PERIOD_LABELS[period.preset]}
            />
          ) : tab === "breakdown" ? (
            <Breakdown rows={rowsFor(by)} by={by} setBy={setBy} all={data} />
          ) : (
            <Reconciliation r={data.reconciliation} />
          )}
        </div>
      </Tabs>
    </FitPage>
  );
}

function OverviewCharts({ series, waterfall, subtitle }: { series: { label: string; revenue: number; cost: number; profit: number }[]; waterfall: Parameters<typeof WaterfallChart>[0]["data"]; subtitle: string }) {
  const fit = useFit();
  return fit ? (
    <div className="grid min-h-0 flex-1 grid-cols-[1.4fr_1fr] gap-3">
      <ChartFill>
        <RevenueProfitChart data={series} />
      </ChartFill>
      <ChartFill>
        <WaterfallChart data={waterfall} description={`${subtitle}; revenue = Yesim cost + markup − discounts`} />
      </ChartFill>
    </div>
  ) : (
    <div className="grid gap-4">
      <RevenueProfitChart data={series} />
      <WaterfallChart data={waterfall} />
    </div>
  );
}

function Breakdown({ rows, by, setBy, all }: { rows: ProfitRow[]; by: By; setBy: (b: By) => void; all: ProfitReport }) {
  const resellers = all.byReseller.filter((r) => r.key !== "direct" && r.revenue > 1);
  const top = useMemo(() => [...resellers].sort((a, b) => b.marginPercent - a.marginPercent), [resellers]);
  const columns: Column<ProfitRow>[] = [
    { id: "label", header: BY_LABEL[by], cell: (r) => <span className="font-medium">{r.label}</span>, sortValue: (r) => r.label, hideable: false, className: "whitespace-normal min-w-40" },
    { id: "mb", header: "Data", align: "right", cell: (r) => formatBytes(r.mb * 1048576), sortValue: (r) => r.mb },
    { id: "revenue", header: "Revenue", align: "right", cell: (r) => formatMoney(r.revenue), sortValue: (r) => r.revenue },
    { id: "cost", header: "Yesim cost", align: "right", cell: (r) => formatMoney(r.cost), sortValue: (r) => r.cost },
    { id: "profit", header: "Profit", align: "right", cell: (r) => <span className="font-medium text-accent">{formatMoney(r.profit)}</span>, sortValue: (r) => r.profit },
    {
      id: "margin",
      header: "Margin",
      align: "right",
      cell: (r) => (
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-3">
            <span className="block h-full rounded-full bg-[var(--gradient-signature)]" style={{ width: `${Math.max(0, Math.min(100, r.marginPercent))}%` }} />
          </span>
          {pct(r.marginPercent)}
        </span>
      ),
      sortValue: (r) => r.marginPercent,
    },
  ];
  return (
    <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-h-0 flex-col">
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => r.key}
          defaultSort={{ id: "revenue", desc: true }}
          caption="Profit breakdown"
          toolbar={
            <div role="radiogroup" aria-label="Break down by" className="glass-card inline-flex h-10 items-center gap-0.5 !rounded-full p-1">
              {(Object.keys(BY_LABEL) as By[]).map((k) => (
                <button key={k} role="radio" aria-checked={by === k} onClick={() => setBy(k)} className={cn("h-8 rounded-full px-3 text-small font-medium", by === k ? "bg-surface-3 text-fg" : "text-fg-2 hover:text-fg")}>
                  By {BY_LABEL[k].toLowerCase()}
                </button>
              ))}
            </div>
          }
        />
      </div>
      <FitScroll className="xl:!mx-0 xl:!px-0">
        <MarginList title="Highest margin" rows={top.slice(0, 3)} />
        <MarginList title="Lowest margin" rows={top.slice(-3).reverse()} warn note="Margin = profit ÷ revenue. It depends on the markup, the discount and the networks customers use." />
      </FitScroll>
    </div>
  );
}

function MarginList({ title, rows, warn, note }: { title: string; rows: ProfitRow[]; warn?: boolean; note?: string }) {
  return (
    <GlassCard className="flex flex-col gap-3">
      <h3 className="text-body font-semibold">{title}</h3>
      {rows.map((r) => (
        <div key={r.key} className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-body">{r.label}</span>
          <span className={cn("shrink-0 text-body font-medium tabular", warn ? "text-warning" : "text-accent")}>{pct(r.marginPercent)}</span>
        </div>
      ))}
      {note ? <p className="border-t border-border pt-3 text-small text-fg-3">{note}</p> : null}
    </GlassCard>
  );
}

function Reconciliation({ r }: { r: ProfitReport["reconciliation"] }) {
  const ok = Math.abs(r.difference) <= r.tolerance;
  return (
    <FitScroll>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <GlassCard className="flex flex-col gap-4">
          <h2 className="text-section font-semibold">Yesim balance vs our records</h2>
          <dl className="flex flex-col gap-2 text-body">
            <Line label="Deposits we sent to Yesim" value={formatMoney(r.deposits)} />
            <Line label="Yesim cost of all usage to date" value={`−${formatMoney(r.costToDate)}`} />
            <div className="my-1 h-px bg-border" />
            <Line label="Balance our records imply" value={formatMoney(r.implied)} strong />
            <Line label={`Balance Yesim reports (${formatDateTime(r.reportedAt)})`} value={formatMoney(r.reported)} strong />
          </dl>
          <div
            className={cn("flex items-start gap-2.5 rounded-control border px-4 py-3 text-body", ok ? "border-[color-mix(in_oklab,var(--accent)_40%,transparent)] bg-[color-mix(in_oklab,var(--accent)_8%,transparent)]" : "border-[color-mix(in_oklab,var(--danger)_40%,transparent)] bg-[color-mix(in_oklab,var(--danger)_8%,transparent)]")}
          >
            {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={1.5} /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" strokeWidth={1.5} />}
            <span>
              Difference <b className="tabular">{formatMoney(r.difference)}</b> ({ok ? "within" : "outside"} the €{r.tolerance.toFixed(2)} tolerance). Usage still estimated (a late report) explains small differences until the nightly
              report makes it final.
            </span>
          </div>
        </GlassCard>
        <GlassCard className="flex flex-col gap-3">
          <h2 className="text-section font-semibold">Deposits to Yesim</h2>
          <ul className="flex flex-col divide-y divide-border">
            {r.depositsList.map((d) => (
              <li key={d.reference} className="flex items-center justify-between py-2.5 text-body">
                <span>
                  {formatDate(d.date)} · <span className="font-mono text-small">{d.reference}</span>
                </span>
                <span className="font-medium tabular">{formatMoney(d.amount)}</span>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>
    </FitScroll>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-fg-2">{label}</dt>
      <dd className={cn("tabular", strong && "font-semibold")}>{value}</dd>
    </div>
  );
}
