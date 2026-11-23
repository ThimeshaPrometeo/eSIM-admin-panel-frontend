"use client";

import { FitPage } from "@/components/platform/fit-page";
import { useMemo, useState } from "react";
import { FileDown, RefreshCw, Sheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/platform/data-table";
import { FilterSelect, ResellerSelect, SearchInput } from "@/components/platform/fields";
import { NetworkBadges } from "@/components/platform/network-badges";
import { PageHeader } from "@/components/platform/primitives";
import { usePlatform } from "@/contexts/platform-context";
import { useAction } from "@/hooks/use-action";
import { usePermission } from "@/hooks/use-permission";
import { useResource } from "@/hooks/use-resource";
import { logDownload } from "@/lib/api/audit";
import { catalogueApi } from "@/lib/api/catalogue";
import { errorMessage } from "@/lib/api/errors";
import { exportPdf, exportXlsx, type ExportColumn } from "@/lib/exports";
import { countryFlag } from "@/lib/platform/coverage";
import { formatDateTime, formatRelative } from "@/lib/platform/dates";
import { formatPerGb, formatPerMb } from "@/lib/platform/money";
import type { PriceListRow } from "@/lib/platform/types";

const perGb = (n: number | null | undefined) => (n === null || n === undefined ? null : Math.round(n * 1024 * 100) / 100);
const perMb = (n: number | null | undefined) => (n === null || n === undefined ? null : Number(n.toPrecision(4)));

/** Price list (spec 8.13): per country and network, the viewer's prices; admins also cost, retail and a reseller's prices. */
export function PriceListClient() {
  const { me } = usePlatform();
  const { isTenant, rules } = usePermission();
  const [q, setQ] = useState("");
  const [zone, setZone] = useState<string | null>(null);
  const [tech, setTech] = useState<"5g" | "4g" | null>(null);
  const [resellerId, setResellerId] = useState<string | null>(null);
  const { data, loading, error } = useResource(() => catalogueApi.getCurrentPriceList({ resellerId }), [resellerId]);
  const { run, pending } = useAction();
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);

  const zones = useMemo(() => [...new Set((data?.rows ?? []).flatMap((r) => r.zones))].sort(), [data]);
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.rows ?? []).filter(
      (r) =>
        r.iso2 !== "--" &&
        (!term || r.country.toLowerCase().includes(term) || r.operator.toLowerCase().includes(term) || r.mccMnc.includes(term) || r.tadigs.some((t) => t.toLowerCase().includes(term))) &&
        (!zone || r.zones.includes(zone)) &&
        (tech !== "5g" || r.nr) &&
        (tech !== "4g" || r.lte),
    );
  }, [data, q, zone, tech]);

  const reseller = data?.resellerName;
  const columns: Column<PriceListRow>[] = [
    {
      id: "country",
      header: "Country",
      cell: (r) => (
        <span className="flex items-center gap-2">
          <span className="text-[16px]">{countryFlag(r.iso2)}</span>
          {r.country}
        </span>
      ),
      sortValue: (r) => r.country,
      hideable: false,
    },
    { id: "network", header: "Network", cell: (r) => r.operator, sortValue: (r) => r.operator },
    { id: "tech", header: "Technology", cell: (r) => <NetworkBadges lte={r.lte} fiveG={r.nr} volte={r.volte} /> },
    { id: "mccmnc", header: "MCC-MNC", cell: (r) => <span className="font-mono text-small text-fg-2">{r.mccMnc}</span>, defaultHidden: true },
    ...(isTenant
      ? [
          { id: "cost", header: "Supplier €/MB", align: "right" as const, cell: (r: PriceListRow) => formatPerMb(r.costPerMb), sortValue: (r: PriceListRow) => r.costPerMb ?? null },
          { id: "costgb", header: "Supplier €/GB", align: "right" as const, cell: (r: PriceListRow) => formatPerGb(r.costPerMb), sortValue: (r: PriceListRow) => r.costPerMb ?? null },
          { id: "retail", header: "Retail €/GB", align: "right" as const, cell: (r: PriceListRow) => formatPerGb(r.retailPricePerMb), sortValue: (r: PriceListRow) => r.retailPricePerMb ?? null, defaultHidden: true },
          ...(reseller
            ? [
                { id: "rmb", header: `${reseller} €/MB`, align: "right" as const, cell: (r: PriceListRow) => formatPerMb(r.resellerPricePerMb), sortValue: (r: PriceListRow) => r.resellerPricePerMb ?? null },
                { id: "rgb", header: `${reseller} €/GB`, align: "right" as const, cell: (r: PriceListRow) => <span className="font-medium">{formatPerGb(r.resellerPricePerMb)}</span>, sortValue: (r: PriceListRow) => r.resellerPricePerMb ?? null },
              ]
            : []),
        ]
      : [
          { id: "mb", header: "Price per MB", align: "right" as const, cell: (r: PriceListRow) => formatPerMb(r.pricePerMb), sortValue: (r: PriceListRow) => r.pricePerMb },
          { id: "gb", header: "Price per GB", align: "right" as const, cell: (r: PriceListRow) => <span className={r.pricePerMb === null ? "text-fg-3" : "font-medium"}>{formatPerGb(r.pricePerMb)}</span>, sortValue: (r: PriceListRow) => r.pricePerMb },
        ]),
    { id: "zones", header: "Zones", cell: (r) => <span className="text-small text-fg-2">{r.zones.join(", ")}</span>, defaultHidden: true },
  ];

  const exportCols: ExportColumn<PriceListRow>[] = [
    { header: "Country", value: (r) => r.country, width: 22 },
    { header: "ISO", value: (r) => r.iso2, width: 6 },
    { header: "Network", value: (r) => r.operator, width: 30 },
    { header: "MCC-MNC", value: (r) => r.mccMnc, width: 12 },
    { header: "4G", value: (r) => (r.lte ? "Yes" : "No"), width: 6 },
    { header: "5G", value: (r) => (r.nr ? "Yes" : "No"), width: 6 },
    { header: "VoLTE", value: (r) => (r.volte ? "Yes" : "No"), width: 7 },
    ...(isTenant
      ? [
          { header: "Supplier €/MB", value: (r: PriceListRow) => perMb(r.costPerMb), width: 14 },
          { header: "Supplier €/GB", value: (r: PriceListRow) => perGb(r.costPerMb), width: 14 },
          ...(reseller
            ? [
                { header: `${reseller} €/MB`, value: (r: PriceListRow) => perMb(r.resellerPricePerMb), width: 16 },
                { header: `${reseller} €/GB`, value: (r: PriceListRow) => perGb(r.resellerPricePerMb), width: 16 },
              ]
            : []),
        ]
      : [
          { header: "Price per MB (€)", value: (r: PriceListRow) => perMb(r.pricePerMb), width: 16 },
          { header: "Price per GB (€)", value: (r: PriceListRow) => perGb(r.pricePerMb), width: 16 },
        ]),
  ];

  const doExport = async (kind: "xlsx" | "pdf") => {
    if (!me || !data) return;
    setExporting(kind);
    const base = `price-list-${new Date().toISOString().slice(0, 10)}`;
    try {
      if (kind === "xlsx") await exportXlsx(`${base}.xlsx`, "Price list", exportCols, rows);
      else
        await exportPdf({
          fileName: `${base}.pdf`,
          title: "Price list",
          subtitle: `${isTenant ? (reseller ? `Prices for ${reseller}` : "Supplier cost") : "Your prices"} · version ${data.version} · synced ${formatDateTime(data.syncedAt)} · unavailable networks have no price`,
          columns: exportCols,
          rows,
          watermark: { fullName: me.fullName, username: me.username },
        });
      await logDownload("price_list", kind);
      toast.success(kind === "xlsx" ? "Excel file downloaded" : "PDF downloaded");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(null);
    }
  };

  return (
    <FitPage>
      <PageHeader
        title="Price list"
        description={
          isTenant
            ? "Supplier cost per network, the retail price for direct sales, and what any reseller pays."
            : "Your price per network. You pay per MB used, at the price of the network the phone is on."
        }
        actions={
          <>
            {data ? (
              <span className="text-small text-fg-3" title={formatDateTime(data.syncedAt)}>
                Synced {formatRelative(data.syncedAt)} · version {data.version}
              </span>
            ) : null}
            {rules.canSyncPriceList(me) ? (
              <Button variant="secondary" disabled={pending} onClick={() => run(() => catalogueApi.syncPriceList(), { success: "Price list synced", description: "No prices changed." })}>
                <RefreshCw strokeWidth={1.5} />
                Sync now
              </Button>
            ) : null}
          </>
        }
      />
      <DataTable
        rows={data ? rows : undefined}
        loading={loading}
        error={error}
        columns={columns}
        rowKey={(r) => r.id}
        pageSize={25}
        defaultSort={{ id: "country" }}
        caption="Price list"
        toolbar={
          <>
            <SearchInput value={q} onChange={setQ} placeholder="Search country, network, MCC-MNC" />
            <FilterSelect label="Zone" value={zone} onChange={setZone} all="All zones" options={zones.map((z) => ({ value: z, label: z }))} />
            <FilterSelect label="Technology" value={tech} onChange={setTech} all="Any technology" options={[{ value: "5g", label: "5G" }, { value: "4g", label: "4G" }]} className="sm:w-40" />
            {isTenant ? <ResellerSelect value={resellerId} onChange={setResellerId} all="No reseller" /> : null}
          </>
        }
        actions={
          <>
            <Button variant="secondary" size="sm" disabled={!data || !!exporting} onClick={() => doExport("xlsx")}>
              <Sheet strokeWidth={1.5} />
              Excel
            </Button>
            <Button variant="secondary" size="sm" disabled={!data || !!exporting} onClick={() => doExport("pdf")}>
              <FileDown strokeWidth={1.5} />
              PDF
            </Button>
          </>
        }
        empty={{ title: "No networks match", description: "Try another search or filter.", illustration: "globe" }}
      />
    </FitPage>
  );
}
