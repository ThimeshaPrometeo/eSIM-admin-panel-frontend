"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChartFill } from "@/components/platform/charts/chart-kit";
import { CountryBar, UsageAreaChart, usageSeries } from "@/components/platform/charts/charts";
import { DataTable, type Column } from "@/components/platform/data-table";
import { FilterSelect, PeriodSelect, ResellerSelect, UnitSelect } from "@/components/platform/fields";
import { FitPage, useFit } from "@/components/platform/fit-page";
import { GlassCard } from "@/components/platform/glass-card";
import { PageHeader, StatBlock } from "@/components/platform/primitives";
import { EstimatedChip } from "@/components/platform/status-chip";
import { usePermission } from "@/hooks/use-permission";
import { useResource } from "@/hooks/use-resource";
import { logDownload } from "@/lib/api/audit";
import { errorMessage } from "@/lib/api/errors";
import { operationsApi } from "@/lib/api/operations";
import { exportCsv, exportPdf } from "@/lib/exports";
import { countryFlag } from "@/lib/platform/coverage";
import { formatAxisDate, formatDate } from "@/lib/platform/dates";
import { formatMoney } from "@/lib/platform/money";
import { customPeriod, periodFor, PERIOD_LABELS, type Period } from "@/lib/platform/period";
import type { UsageReport, UsageReportRow } from "@/lib/platform/types";
import { formatBytes, toUnit, type DataUnit } from "@/lib/platform/units";

const round = (n: number) => Math.round(n * 100) / 100;
const isTenantParam = (v: string | null) => !!v && /^[a-z0-9-]{1,40}$/i.test(v);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
function periodFromParams(params: URLSearchParams): Period | null {
  const from = params.get("from");
  const to = params.get("to");
  return from && to && DATE.test(from) && DATE.test(to) ? customPeriod(from, to) : null;
}

/** Usage (spec 8.7): data and cost per eSIM in a period. Admin/staff see everyone; resellers their own eSIMs. */
export function UsageClient() {
  const { me, isTenant } = usePermission();
  // ?country=, ?from=&to=, ?reseller= from a dashboard link
  const params = useSearchParams();
  const [period, setPeriod] = useState<Period>(() => periodFromParams(params) ?? { ...periodFor("30d"), granularity: "day" });
  const [resellerId, setResellerId] = useState<string | null>(() => (isTenantParam(params.get("reseller")) ? params.get("reseller") : null));
  const [planId, setPlanId] = useState<string | null>(null);
  const [iso2, setIso2] = useState<string | null>(() => {
    const c = params.get("country")?.toUpperCase();
    return c && /^[A-Z]{2}$/.test(c) ? c : null;
  });
  // ?network= from the dashboard's networks list
  const [networkId, setNetworkId] = useState<string | null>(() => {
    const n = params.get("network");
    return n && /^[a-z0-9-]{1,40}$/i.test(n) ? n : null;
  });
  const [unit, setUnit] = useState<DataUnit>("GB");
  const { data, loading, error } = useResource(
    () => operationsApi.getUsageReport(period, { resellerId, planId, iso2, networkId }),
    [period.from, period.to, period.granularity, resellerId, planId, iso2, networkId],
  );
  const chargeLabel = isTenant ? "Charged" : "Your cost";

  const columns: Column<UsageReportRow>[] = [
    {
      id: "esim",
      header: "eSIM",
      hideable: false,
      className: "whitespace-normal min-w-40",
      cell: (r) => (
        <Link href={`/esim/esims/${r.esimId}`} onClick={(e) => e.stopPropagation()} className="flex flex-col hover:text-primary">
          <span className="font-mono text-small">…{r.iccid.slice(-8)}</span>
          <span className="text-small text-fg-3">
            {r.customerName ?? "No customer"}
            {isTenant ? ` · ${r.resellerName ?? "Direct"}` : ""}
          </span>
        </Link>
      ),
      sortValue: (r) => r.iccid,
    },
    ...(isTenant ? [{ id: "reseller", header: "Reseller", defaultHidden: true, cell: (r: UsageReportRow) => r.resellerName ?? <span className="text-fg-2">Direct</span>, sortValue: (r: UsageReportRow) => r.resellerName ?? "" }] : []),
    {
      id: "plans",
      header: "Plan and where",
      className: "whitespace-normal min-w-44",
      cell: (r) => (
        <span className="flex flex-col">
          <span>{r.plans.join(", ")}</span>
          <span className="text-small text-fg-3">
            {r.countries.slice(0, 3).map(countryFlag).join(" ")}
            {r.countries.length > 3 ? ` +${r.countries.length - 3}` : ""} · {r.topNetwork ?? "—"}
          </span>
        </span>
      ),
      sortValue: (r) => r.plans[0] ?? "",
    },
    { id: "data", header: `Data (${unit})`, align: "right", cell: (r) => round(toUnit(r.bytes, unit)).toLocaleString("en-GB"), sortValue: (r) => r.bytes },
    {
      id: "charge",
      header: chargeLabel,
      align: "right",
      cell: (r) => (
        <span className="flex flex-col items-end gap-0.5">
          <span className="font-medium tabular">{formatMoney(r.charge)}</span>
          {r.estimated ? <EstimatedChip className="h-5 text-[11px]" /> : null}
        </span>
      ),
      sortValue: (r) => r.charge,
    },
    ...(isTenant ? [{ id: "cost", header: "Yesim cost", align: "right" as const, cell: (r: UsageReportRow) => <span className="tabular text-fg-2">{formatMoney(r.yesimCost)}</span>, sortValue: (r: UsageReportRow) => r.yesimCost ?? 0 }] : []),
  ];

  const download = async (kind: "csv" | "pdf") => {
    if (!data || !me) return;
    const cols = [
      { header: "ICCID", value: (r: UsageReportRow) => r.iccid },
      { header: "Customer", value: (r: UsageReportRow) => r.customerName ?? "" },
      ...(isTenant ? [{ header: "Reseller", value: (r: UsageReportRow) => r.resellerName ?? "Direct" }] : []),
      { header: "Plans", value: (r: UsageReportRow) => r.plans.join(", ") },
      { header: "Countries", value: (r: UsageReportRow) => r.countries.join(" ") },
      { header: "Main network", value: (r: UsageReportRow) => r.topNetwork ?? "" },
      { header: `Data (${unit})`, value: (r: UsageReportRow) => round(toUnit(r.bytes, unit)) },
      { header: `${chargeLabel} (EUR)`, value: (r: UsageReportRow) => r.charge },
      ...(isTenant ? [{ header: "Yesim cost (EUR)", value: (r: UsageReportRow) => r.yesimCost ?? 0 }] : []),
      { header: "Status", value: (r: UsageReportRow) => (r.estimated ? "Includes estimated" : "Final") },
    ];
    const name = `usage-${period.from}-${period.to}`;
    try {
      if (kind === "csv") exportCsv(`${name}.csv`, cols, data.rows);
      else
        await exportPdf({
          fileName: `${name}.pdf`,
          title: "Usage report",
          subtitle: `${formatDate(period.from)} to ${formatDate(period.to)} · ${formatBytes(data.totals.bytes)} · ${chargeLabel.toLowerCase()} ${formatMoney(data.totals.charge)}${data.totals.estimatedCharge > 0 ? ` (${formatMoney(data.totals.estimatedCharge)} estimated)` : ""}`,
          columns: cols,
          rows: data.rows,
          watermark: { fullName: me.fullName, username: me.username },
          watermarkOn: data.watermark,
        });
      await logDownload("usage_report", `${period.from}:${period.to}:${kind}`);
      toast.success(kind === "csv" ? "CSV downloaded" : "PDF downloaded");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <FitPage>
      <PageHeader
        title="Usage"
        description={isTenant ? "Data used per eSIM, what its wallet was charged (direct sales: the house wallet, at Yesim cost) and what it cost us at Yesim. Revenue and profit are in Profit and costs." : "Data used per eSIM and what it cost you. Today and yesterday stay estimated until the nightly report."}
        actions={
          <>
            <Button variant="secondary" size="sm" disabled={!data?.rows.length} onClick={() => download("csv")}>
              <FileDown strokeWidth={1.5} />
              CSV
            </Button>
            <Button variant="secondary" size="sm" disabled={!data?.rows.length} onClick={() => download("pdf")}>
              <FileDown strokeWidth={1.5} />
              PDF
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <PeriodSelect value={period} onChange={setPeriod} />
        {isTenant ? <ResellerSelect value={resellerId} onChange={setResellerId} all="Everyone" /> : null}
        <FilterSelect label="Plan" value={planId} onChange={setPlanId} all="Any plan" options={(data?.options.plans ?? []).map((p) => ({ value: p.id, label: p.name }))} />
        <FilterSelect label="Country" value={iso2} onChange={setIso2} all="Any country" options={(data?.options.countries ?? []).map((c) => ({ value: c.iso2, label: `${countryFlag(c.iso2)} ${c.name}` }))} />
        <FilterSelect label="Network" value={networkId} onChange={setNetworkId} all="Any network" options={(data?.options.networks ?? []).map((n) => ({ value: n.id, label: n.name }))} className="sm:w-48" />
      </div>
      <GlassCard className={`grid shrink-0 grid-cols-2 gap-6 ${isTenant ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
        <StatBlock size="sm" label="Data used" value={data?.totals.bytes ?? 0} format={(n) => formatBytes(n, unit)} loading={!data} hint={data ? `${data.totals.esims} eSIM${data.totals.esims === 1 ? "" : "s"}` : undefined} />
        <StatBlock size="sm" label={chargeLabel} value={data?.totals.charge ?? 0} format={formatMoney} loading={!data} hint={data && data.totals.estimatedCharge > 0 ? `${formatMoney(data.totals.estimatedCharge)} estimated` : undefined} />
        {isTenant ? <StatBlock size="sm" label="Yesim cost" value={data?.totals.yesimCost ?? 0} format={formatMoney} loading={!data} /> : null}
        <StatBlock size="sm" label="Countries" value={data?.byCountry.length ?? 0} format={(n) => String(n)} loading={!data} hint={data?.byCountry[0] ? `Most data: ${data.byCountry[0].country}` : undefined} />
      </GlassCard>
      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-h-0 flex-col">
          <DataTable
            rows={data?.rows}
            loading={loading}
            error={error}
            columns={columns}
            rowKey={(r) => r.esimId}
            defaultSort={{ id: "data", desc: true }}
            caption="Usage per eSIM"
            actions={<UnitSelect value={unit} onChange={setUnit} />}
            empty={{ title: "No usage in this period", description: "Try a longer period or another filter.", illustration: "signal" }}
          />
        </div>
        {data ? <UsageCharts data={data} unit={unit} period={period} /> : null}
      </div>
    </FitPage>
  );
}

function UsageCharts({ data, unit, period }: { data: UsageReport; unit: DataUnit; period: Period }) {
  const fit = useFit();
  const label = (b: string) => formatAxisDate(b.length === 4 ? `${b}-01-01` : b.length === 7 ? `${b}-01` : b, period.granularity);
  const series = usageSeries(data.series.map((x) => ({ label: label(x.bucket), value: round(toUnit(x.finalBytes + x.estimatedBytes, unit)), estimated: x.estimatedBytes > 0 })));
  const countries = data.byCountry.slice(0, 8).map((c) => ({ label: c.country, value: round(toUnit(c.bytes, unit)) }));
  const charts = (
    <>
      <UsageAreaChart data={series} unit={unit} title="Data used" description={PERIOD_LABELS[period.preset]} />
      <CountryBar data={countries} unit={unit} />
    </>
  );
  return fit ? (
    <div className="hidden min-h-0 flex-col gap-3 xl:flex">
      <ChartFill>{charts}</ChartFill>
    </div>
  ) : (
    <div className="grid gap-4">{charts}</div>
  );
}
