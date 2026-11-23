"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { DataTable, type Column } from "@/components/platform/data-table";
import { FilterSelect, SearchInput } from "@/components/platform/fields";
import { FitScroll } from "@/components/platform/fit-page";
import { GlassCard } from "@/components/platform/glass-card";
import { NetworkBadges } from "@/components/platform/network-badges";
import { useResource } from "@/hooks/use-resource";
import { financeApi } from "@/lib/api/finance";
import { peopleApi } from "@/lib/api/people";
import { countryFlag } from "@/lib/platform/coverage";
import { formatDate, formatDateTime } from "@/lib/platform/dates";
import { formatPerGb, formatPerMb } from "@/lib/platform/money";
import type { MarkupChange, PriceBreakdown, PriceChange, ResellerPriceCell } from "@/lib/platform/types";
import { cn } from "@/lib/utils";

type Row = PriceBreakdown["rows"][number];
const pct = (n: number | null) => (n === null ? "—" : `${n.toLocaleString("en-GB", { maximumFractionDigits: 1 })}%`);
const eurGb = (n: number | null) => (n === null ? "—" : `€${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

/**
 * Price breakdown (spec 8.32): for every network the chain Yesim €/MB →
 * markup → discount → reseller price, per MB and per GB, profit per GB and
 * margin. One reseller shows the whole chain; two or three compare side by side.
 */
export function BreakdownTab() {
  const resellers = useResource(() => peopleApi.listResellerOptions(), ["reseller-options"]);
  const [ids, setIds] = useState<string[]>(["r1"]);
  const [q, setQ] = useState("");
  const [tech, setTech] = useState<"5g" | null>(null);
  const { data, loading } = useResource(() => financeApi.getPriceBreakdown(ids), [ids]);
  const rows = useMemo(
    () => (data?.rows ?? []).filter((r) => (!q || r.country.toLowerCase().includes(q.toLowerCase()) || r.operator.toLowerCase().includes(q.toLowerCase())) && (tech !== "5g" || r.nr)),
    [data, q, tech],
  );
  const toggle = (id: string) => setIds((cur) => (cur.includes(id) ? (cur.length > 1 ? cur.filter((x) => x !== id) : cur) : cur.length >= 3 ? [...cur.slice(1), id] : [...cur, id]));
  const one = ids.length === 1;
  const c = (r: Row, i: number): ResellerPriceCell | undefined => r.cells[i];

  const base: Column<Row>[] = [
    { id: "country", header: "Country", cell: (r) => <span className="flex items-center gap-2">{countryFlag(r.iso2)} {r.country}</span>, sortValue: (r) => r.country, hideable: false },
    { id: "network", header: "Network", cell: (r) => r.operator, sortValue: (r) => r.operator, className: "whitespace-normal min-w-36" },
    { id: "tech", header: "Tech", cell: (r) => <NetworkBadges lte={r.lte} fiveG={r.nr} volte={r.volte} />, defaultHidden: true },
    { id: "cost", header: "Yesim €/MB", align: "right", cell: (r) => formatPerMb(r.costPerMb), sortValue: (r) => r.costPerMb },
  ];
  const chain: Column<Row>[] = one
    ? [
        { id: "markup", header: "Markup", align: "right", cell: (r) => pct(c(r, 0)?.markupPercent ?? null) },
        { id: "discount", header: "Discount", align: "right", cell: (r) => (c(r, 0)?.discountPercent ? pct(c(r, 0)!.discountPercent) : "—") },
        { id: "mb", header: "Price €/MB", align: "right", cell: (r) => formatPerMb(c(r, 0)?.pricePerMb), sortValue: (r) => c(r, 0)?.pricePerMb ?? null },
        { id: "gb", header: "Price €/GB", align: "right", cell: (r) => <span className="font-medium">{formatPerGb(c(r, 0)?.pricePerMb)}</span>, sortValue: (r) => c(r, 0)?.pricePerMb ?? null },
        { id: "profit", header: "Profit €/GB", align: "right", cell: (r) => <span className="text-accent">{eurGb(c(r, 0)?.profitPerGb ?? null)}</span>, sortValue: (r) => c(r, 0)?.profitPerGb ?? null },
        { id: "margin", header: "Margin", align: "right", cell: (r) => pct(c(r, 0)?.marginPercent ?? null), sortValue: (r) => c(r, 0)?.marginPercent ?? null },
      ]
    : ids.map((_id, i) => ({
        id: `r${i}`,
        header: `${data?.resellers[i]?.name ?? `#${i + 1}`}`,
        align: "right" as const,
        className: "whitespace-normal min-w-36",
        sortValue: (r: Row) => c(r, i)?.pricePerMb ?? null,
        cell: (r: Row) => (
          <span className="flex flex-col items-end">
            <span className="font-medium tabular">{formatPerGb(c(r, i)?.pricePerMb)} /GB</span>
            <span className="text-small tabular text-fg-3">
              profit <span className="text-accent">{eurGb(c(r, i)?.profitPerGb ?? null)}</span> · {pct(c(r, i)?.marginPercent ?? null)}
            </span>
          </span>
        ),
      }));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-small text-fg-2">Resellers (up to three):</span>
        {(resellers.data ?? []).map((r) => {
          const on = ids.includes(r.id);
          return (
            <button
              key={r.id}
              onClick={() => toggle(r.id)}
              aria-pressed={on}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-small font-medium transition-colors",
                on ? "border-primary bg-[color-mix(in_oklab,var(--primary)_12%,transparent)] text-fg" : "border-border text-fg-2 hover:border-border-strong hover:text-fg",
              )}
            >
              {on ? <Check className="size-3.5" strokeWidth={2} /> : null}
              {r.name}
            </button>
          );
        })}
      </div>
      {data ? (
        <p className="text-small text-fg-2">
          {data.resellers.map((r) => `${r.name}: markup ${r.markupPercent}%${r.discountPercent ? `, discount ${r.discountPercent}%` : ""}`).join(" · ")}. Price per MB = Yesim €/MB × (1 + markup) × (1 − discount). Margin = profit ÷ price.
        </p>
      ) : null}
      <DataTable
        rows={data ? rows : undefined}
        loading={loading}
        columns={[...base, ...chain]}
        rowKey={(r) => r.id}
        defaultSort={{ id: "country" }}
        caption="Price breakdown"
        toolbar={
          <>
            <SearchInput value={q} onChange={setQ} placeholder="Search country or network" />
            <FilterSelect label="Technology" value={tech} onChange={setTech} all="Any technology" options={[{ value: "5g", label: "5G only" }]} className="sm:w-40" />
          </>
        }
      />
    </div>
  );
}

/** Yesim price list versions with "what changed", and every reseller's markup history. */
export function HistoryTab() {
  const versions = useResource(() => financeApi.listPriceVersions(), ["price-versions"]);
  const [view, setView] = useState<"versions" | "markups">("versions");
  const [picked, setPicked] = useState<number | null>(null);
  const version = picked ?? versions.data?.find((v) => v.changes > 0)?.version ?? null;
  const changes = useResource(() => financeApi.getPriceChanges(version!), [version], version !== null);
  const markups = useResource(() => financeApi.listMarkupHistory(), ["markup-history"]);
  const resellerNames = changes.data?.[0]?.impact.map((i) => i.resellerName) ?? [];

  const changeCols: Column<PriceChange>[] = [
    { id: "network", header: "Network", cell: (c) => <span className="flex flex-col"><span>{countryFlag(c.iso2)} {c.operator}</span><span className="text-small text-fg-3">{c.country}</span></span>, sortValue: (c) => c.country, hideable: false, className: "whitespace-normal min-w-40" },
    {
      id: "cost",
      header: "Yesim €/MB",
      align: "right",
      cell: (c) => (
        <span className="flex flex-col items-end">
          <span className="font-medium tabular">{formatPerMb(c.newCost)}</span>
          <span className="text-small text-fg-3 tabular">was {formatPerMb(c.oldCost)}</span>
        </span>
      ),
      sortValue: (c) => c.newCost,
    },
    {
      id: "delta",
      header: "Change",
      align: "right",
      cell: (c) => (
        <span className={cn("inline-flex items-center gap-1 font-medium", c.deltaPercent > 0 ? "text-danger" : "text-accent")}>
          {c.deltaPercent > 0 ? <ArrowUp className="size-3.5" strokeWidth={2} /> : <ArrowDown className="size-3.5" strokeWidth={2} />}
          {Math.abs(c.deltaPercent).toFixed(1)}%
        </span>
      ),
      sortValue: (c) => c.deltaPercent,
    },
    ...resellerNames.slice(0, 3).map((name, i) => ({
      id: `r${i}`,
      header: `${name} €/GB`,
      align: "right" as const,
      className: "whitespace-normal min-w-28",
      cell: (c: PriceChange) => (
        <span className="flex flex-col items-end">
          <span className="font-medium tabular">{eurGb(c.impact[i]!.newPerGb)}</span>
          <span className="text-small text-fg-3 tabular">was {eurGb(c.impact[i]!.oldPerGb)}</span>
        </span>
      ),
    })),
  ];
  const markupCols: Column<MarkupChange>[] = [
    { id: "when", header: "Changed", cell: (m) => <span className="text-fg-2" title={formatDateTime(m.changedAt)}>{formatDate(m.changedAt)}</span>, sortValue: (m) => m.changedAt, hideable: false },
    { id: "reseller", header: "Reseller", cell: (m) => m.resellerName, sortValue: (m) => m.resellerName },
    { id: "change", header: "Markup", cell: (m) => (m.previousPercent === null ? <span>{m.markupPercent}% <span className="text-fg-3">(starting)</span></span> : <span className="font-medium">{m.previousPercent}% → {m.markupPercent}%</span>) },
    { id: "from", header: "Effective from", cell: (m) => formatDateTime(m.effectiveAt), sortValue: (m) => m.effectiveAt },
    { id: "who", header: "By", cell: (m) => m.changedBy },
    { id: "reason", header: "Reason", cell: (m) => <span className="text-fg-2">{m.reason}</span>, className: "whitespace-normal min-w-48" },
  ];

  const chip = (key: typeof view, label: string) => (
    <button
      onClick={() => setView(key)}
      aria-pressed={view === key}
      className={cn(
        "inline-flex h-8 items-center rounded-full border px-3 text-small font-medium transition-colors",
        view === key ? "border-primary bg-[color-mix(in_oklab,var(--primary)_12%,transparent)] text-fg" : "border-border text-fg-2 hover:border-border-strong hover:text-fg",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {chip("versions", "Yesim price versions")}
        {chip("markups", `Markup changes${markups.data ? ` (${markups.data.filter((m) => m.previousPercent !== null).length})` : ""}`)}
      </div>
      {view === "versions" ? (
        <FitScroll>
          <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
            <GlassCard className="flex flex-col gap-2 self-start !p-3">
              <p className="px-2 pt-1 text-small font-medium text-fg-2">Yesim price list versions</p>
              {(versions.data ?? []).map((v) => (
                <button
                  key={v.version}
                  onClick={() => setPicked(v.version)}
                  className={cn("flex flex-col rounded-control px-3 py-2 text-left transition-colors", version === v.version ? "bg-surface-3" : "hover:bg-surface-3/50")}
                >
                  <span className="flex items-center justify-between text-body font-medium">
                    Version {v.version}
                    {v.current ? <span className="rounded-full border border-border px-2 text-[11px] font-normal text-fg-2">Current</span> : null}
                  </span>
                  <span className="text-small text-fg-3">
                    From {formatDate(v.effectiveFrom)} · {v.changes ? `${v.rises} up, ${v.falls} down` : "no price changes"}
                  </span>
                </button>
              ))}
            </GlassCard>
            <section className="flex min-w-0 flex-col gap-3">
              <div>
                <h2 className="text-section font-semibold">What changed{version ? ` in version ${version}` : ""}</h2>
                <p className="text-small text-fg-2">
                  Networks whose Yesim price rose or fell, and what {resellerNames.length > 3 ? "the first three resellers" : "each reseller"} pay per GB now, with
                  today&apos;s markups and discounts. Usage is rated with the price in force on the day.
                </p>
              </div>
              <DataTable rows={changes.data} loading={changes.loading} columns={changeCols} rowKey={(c) => c.networkId} pageSize={20} caption="Price changes" empty={{ title: "No price changes in this version", description: "Pick another version." }} />
            </section>
          </div>
        </FitScroll>
      ) : (
        <>
          <p className="text-small text-fg-2">Every reseller&apos;s markup over time. A change prices all usage from the moment it&apos;s saved, including plans already running; usage before it keeps the earlier markup.</p>
          <DataTable rows={markups.data} loading={markups.loading} columns={markupCols} rowKey={(m) => m.id} defaultSort={{ id: "when", desc: true }} caption="Markup changes" />
        </>
      )}
    </div>
  );
}
