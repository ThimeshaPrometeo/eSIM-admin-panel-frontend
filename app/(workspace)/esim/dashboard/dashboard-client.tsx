"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ChartFill } from "@/components/platform/charts/chart-kit";
import { colorMap, DonutCard, type DonutSlice } from "@/components/platform/charts/donut-card";
import { OVERVIEW_SYNC_ID, TrendChart, trendInsight, type TrendRow } from "@/components/platform/charts/overview-chart";
import { LiveGlobeCard, type Spotlight } from "@/components/platform/live-globe-card";
import {
  AttentionList,
  defaultFilters,
  eur0,
  eur2,
  gb,
  KpiTile,
  MiniTable,
  NetworksRankCard,
  OverviewFilterBar,
  pct,
  Seg,
  SupplyTile,
  TabbedCard,
  TopCountriesCard,
  TrendText,
  type Col,
  type OverviewFilters,
} from "@/components/platform/overview-view";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlatform } from "@/contexts/platform-context";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useResource } from "@/hooks/use-resource";
import { overviewApi } from "@/lib/api/overview";
import { addDays, formatAxisDate } from "@/lib/platform/dates";
import type { OverviewQuery, ResellerOverview, TenantOverview } from "@/lib/platform/types";
import { cn } from "@/lib/utils";

const GB = 1024 ** 3;
/** The dashboard refreshes itself quietly while it's on screen (the live feed and figures). */
const REFRESH_MS = 60_000;

/** A bucket ("2026-11-23", "2026-11" or "2026") as a date range. */
function bucketRange(bucket: string): [string, string] {
  if (bucket.length === 10) return [bucket, bucket];
  if (bucket.length === 7) {
    const next = bucket.slice(5) === "12" ? `${Number(bucket.slice(0, 4)) + 1}-01-01` : `${bucket.slice(0, 5)}${String(Number(bucket.slice(5)) + 1).padStart(2, "0")}-01`;
    return [`${bucket}-01`, addDays(next, -1)];
  }
  return [`${bucket}-01-01`, `${bucket}-12-31`];
}
const axisLabel = (bucket: string, g: OverviewQuery["granularity"]) => formatAxisDate(bucket.length === 4 ? `${bucket}-01-01` : bucket.length === 7 ? `${bucket}-01` : bucket, g);
const days = (n: number | null) => (n === null ? "" : n >= 365 ? "1 yr+" : `~${Math.floor(n)} days`);
const qs = (o: Record<string, string | null | undefined>) => new URLSearchParams(Object.entries(o).filter((e): e is [string, string] => !!e[1])).toString();
// axis ticks keep decimals for small numbers, so a narrow range never shows the same label twice
const tickDigits = (n: number) => (Math.abs(n) < 1 ? 2 : Math.abs(n) < 10 ? 1 : 0);
const axisEur = (n: number) => (Math.abs(n) >= 1000 ? `€${(n / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1 })}k` : `€${n.toLocaleString("en-GB", { maximumFractionDigits: tickDigits(n) })}`);
const axisGb = (n: number) => (n >= 1000 ? `${(n / 1024).toLocaleString("en-GB", { maximumFractionDigits: 1 })} TB` : `${n.toLocaleString("en-GB", { maximumFractionDigits: tickDigits(n) })} GB`);
const gbOf = (n: number) => (n >= 1000 ? `${(n / 1024).toLocaleString("en-GB", { maximumFractionDigits: 2 })} TB` : `${n.toLocaleString("en-GB", { maximumFractionDigits: n < 10 ? 2 : 1 })} GB`);
/** "€9.5k" for notes. */
const eurShort = (n: number) => (Math.abs(n) >= 1000 ? `€${(n / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1 })}k` : eur0(n));
/** "Maroc Telecom (IAM)" → "Maroc Telecom", "Vodafone Italy" → "Vodafone": the country is on the row's code chip. */
const shortOperator = (operator: string, country: string) => operator.replace(new RegExp(`\\s*${country}.*$`), "").replace(/\s*\([^)]*\)\s*$/, "") || operator;
const regionNames = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["en-GB"], { type: "region" }) : null;
/** A country's name: ours first, else the browser's (any country on the globe). */
const countryName = (names: Map<string, string>, iso2: string) => names.get(iso2) ?? regionNames?.of(iso2) ?? iso2;

/**
 * Dashboard (spec 8.1; simplified 2026-11): five tiles, then the live globe,
 * one chart (Revenue | Data) and Needs attention side by side, then top
 * countries, networks and the plan mix (donut). Clicking a country (globe or list) focuses every
 * card on it. Resellers and assistants see their own scope at their price;
 * never Yesim cost or profit. One screen on desktop (1440×900, 1366×768).
 */
export function DashboardClient() {
  const { me } = usePlatform();
  const tenant = me?.role === "admin" || me?.role === "staff";
  const [f, setF] = useState<OverviewFilters>(defaultFilters);
  const q: OverviewQuery = {
    from: f.period.from,
    to: f.period.to,
    granularity: f.period.granularity === "year" ? "month" : f.period.granularity,
    compare: f.compare,
    resellerId: tenant ? f.resellerId : null,
    iso2: f.iso2,
    networkId: f.networkId,
    planId: f.planId,
  };
  // refreshed quietly every minute; a filter change keeps the current figures (dimmed) until the new ones arrive
  const { data, stale } = useResource(() => overviewApi.getOverview(q), [JSON.stringify(q)], true, { pollMs: REFRESH_MS, keepPrevious: true });
  // same breakpoint as the "fit" variant: desktop pages fit the screen
  const fit = useMediaQuery("(min-width: 1024px) and (min-height: 640px)");
  /** Focus every card on a country (null = all countries again). */
  const focus = useCallback((iso2: string | null) => setF((x) => ({ ...x, iso2, networkId: null })), []);

  const body =
    data?.scope === "reseller" || (!data && !tenant) ? (
      <ResellerDashboard data={data?.scope === "reseller" ? data : null} q={q} fit={fit} stale={stale} focus={focus} />
    ) : (
      <TenantDashboard data={data?.scope === "tenant" ? data : null} q={q} fit={fit} stale={stale} focus={focus} />
    );
  return (
    <div className={cn("flex flex-col gap-2.5", fit ? "h-[calc(100dvh-104px)] min-h-[560px]" : "pb-6")}>
      <h1 className="sr-only">Dashboard</h1>
      <OverviewFilterBar value={f} onChange={setF} options={data?.options ?? null} tenant={tenant} />
      {body}
    </div>
  );
}

/**
 * The plan mix donut: the five plans ranked first by `rankBy` (the period's main measure)
 * plus "Other". Colours follow the plan, fixed by that ranking, so switching the
 * measure moves the slices without repainting them.
 */
function planMix<P extends { id: string; name: string }>(plans: P[], value: (p: P) => number, rankBy: (p: P) => number): { slices: DonutSlice[]; colorOf: (k: string) => string } {
  const ranked = plans.filter((p) => rankBy(p) > 0 || value(p) > 0).sort((a, b) => rankBy(b) - rankBy(a) || value(b) - value(a));
  const top = ranked.slice(0, 5);
  const colors = colorMap(top.map((p) => p.id));
  const other = ranked.slice(5).reduce((a, p) => a + value(p), 0);
  const slices: DonutSlice[] = top.filter((p) => value(p) > 0).map((p) => ({ key: p.id, label: p.name, value: value(p) }));
  if (other > 0) slices.push({ key: "other", label: "Other plans", value: other });
  return { slices, colorOf: (k) => colors.get(k) ?? "var(--series-other)" };
}

type Shared = { q: OverviewQuery; fit: boolean; stale: boolean; focus: (iso2: string | null) => void };

/** Tiles, then [globe | chart | attention], then [countries | networks | plan mix] in the same columns; dims while a filter change loads. */
function Layout({ fit, stale, kpis, main, bottom }: { fit: boolean; stale: boolean; kpis: ReactNode; main: [ReactNode, ReactNode, ReactNode]; bottom: [ReactNode, ReactNode, ReactNode] }) {
  const dim = cn("transition-opacity duration-200", stale && "opacity-60");
  if (!fit)
    return (
      <div className={cn("flex flex-col gap-3", dim)} aria-busy={stale || undefined}>
        {kpis}
        {[...main, ...bottom].map((n, i) => (
          <div key={i} className="h-[320px] min-w-0">
            {n}
          </div>
        ))}
      </div>
    );
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-2.5", dim)} aria-busy={stale || undefined}>
      {kpis}
      <div className="grid min-h-0 flex-[1.3] grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)] gap-2.5">
        {main.map((n, i) => (
          <div key={i} className="min-h-0 min-w-0">
            {n}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)] gap-2.5">
        {bottom.map((n, i) => (
          <div key={i} className="min-h-0 min-w-0">
            {n}
          </div>
        ))}
      </div>
    </div>
  );
}

const loadingCard = <Skeleton className="h-full min-h-[200px] rounded-card" />;

/** A stable empty list (a new `[]` on every render would look like new data). */
const NONE: never[] = [];

/** Keeps the world view (all countries) while a country is in focus, so the globe and list can switch. */
function useWorld<T>(value: T, focused: string | null, stale: boolean) {
  const [world, setWorld] = useState(value);
  if (!focused && !stale && value !== world) setWorld(value);
  return focused ? world : value;
}

// ------------------------------------------------------------------- admin

function TenantDashboard({ data, q, fit, stale, focus }: Shared & { data: TenantOverview | null }) {
  const router = useRouter();
  const money = data?.money ?? true;
  const [measure, setMeasure] = useState<"revenue" | "data">("revenue");
  const [countryMetric, setCountryMetric] = useState<"revenue" | "bytes">("revenue");
  const [networkMetric, setNetworkMetric] = useState<"bytes" | "cost" | "profit">("bytes");
  const [tab, setTab] = useState<"attention" | "plans" | "resellers">("attention");
  const [planMetric, setPlanMetric] = useState<"revenue" | "sold">("revenue");
  const cm = money ? countryMetric : "bytes";
  const nm = money ? networkMetric : "bytes";
  const chartMeasure = money ? measure : "data";
  const k = data?.kpis;
  const reseller = q.resellerId ?? null;
  const focused = q.iso2 ?? null;
  const per = q.granularity;
  const series = useMemo(() => data?.series ?? [], [data?.series]);

  // ---- the chart: revenue as Yesim cost + profit, or data used
  const rows: TrendRow[] = useMemo(
    () =>
      series.map((b): TrendRow =>
        chartMeasure === "data"
          ? { bucket: b.bucket, label: axisLabel(b.bucket, per), estimated: b.estimated, total: b.bytes / GB, data: b.bytes / GB }
          : { bucket: b.bucket, label: axisLabel(b.bucket, per), estimated: b.estimated, total: b.revenue, cost: b.cost, profit: Math.max(0, b.profit), realProfit: b.profit, previous: b.previousRevenue ?? -1 },
      ),
    [series, per, chartMeasure],
  );
  const insight = useMemo(() => trendInsight(rows, chartMeasure === "data" ? gbOf : eur0, per), [rows, chartMeasure, per]);
  const openDay = (bucket: string) => {
    const [from, to] = bucketRange(bucket);
    router.push(chartMeasure === "revenue" ? `/esim/profit?${qs({ from, to, reseller })}` : `/esim/usage?${qs({ from, to, reseller, country: focused })}`);
  };

  // ---- countries: the world ranking stays while a country is in focus
  const names = useMemo(() => new Map([...(data?.options.countries ?? []).map((c) => [c.iso2, c.name] as const), ...(data?.countries ?? []).map((c) => [c.iso2, c.name] as const)]), [data?.options.countries, data?.countries]);
  const worldCountries = useWorld(data?.countries ?? NONE, focused, stale);
  const countries = useMemo(() => [...worldCountries].sort((a, b) => (cm === "bytes" ? b.bytes - a.bytes : b.revenue - a.revenue)), [worldCountries, cm]);
  const glow = useMemo(() => Object.fromEntries(countries.map((c) => [c.iso2, cm === "bytes" ? c.bytes : c.revenue])), [countries, cm]);
  const openUsage = (o: Record<string, string | null | undefined>) => `/esim/usage?${qs({ from: q.from, to: q.to, reseller, country: focused, ...o })}`;

  const networks = useMemo(() => [...(data?.networks ?? [])].sort((a, b) => (nm === "bytes" ? b.bytes - a.bytes : b[nm] - a[nm])), [data?.networks, nm]);

  const spotlight: Spotlight | null =
    focused && k && !stale
      ? {
          iso2: focused,
          name: countryName(names, focused),
          stats: money
            ? [
                { label: "Revenue", value: eur0(k.revenue.value) },
                { label: "Profit", value: `${eur0(k.profit.value)} · ${Math.round(k.marginPercent.value)}%`, tone: "good" },
                { label: "Data used", value: gb(k.bytes.value) },
                { label: "Active eSIMs", value: k.activeEsims.value.toLocaleString("en-GB") },
              ]
            : [
                { label: "Data used", value: gb(k.bytes.value) },
                { label: "Active eSIMs", value: k.activeEsims.value.toLocaleString("en-GB") },
              ],
          href: openUsage({}),
        }
      : null;

  const est = k?.estimated;
  const kpis = (
    <div className={cn("grid shrink-0 grid-cols-2 gap-2.5 sm:grid-cols-3", money ? "lg:grid-cols-5" : "lg:grid-cols-3")}>
      {money ? (
        <>
          <KpiTile
            label="Revenue"
            value={k ? eur0(k.revenue.value) : ""}
            trend={k?.revenue}
            note={est && est.revenue > 0 ? `incl. ${eurShort(est.revenue)} est.` : undefined}
            loading={!k}
            title={k ? `Reseller charges and direct sales.${est && est.revenue > 0 ? ` ${eur0(est.revenue)} is estimated (provisional prices until tonight's report).` : ""}${k.revenue.previous != null ? ` Previous period ${eur0(k.revenue.previous)}.` : ""}` : undefined}
          />
          <KpiTile
            label="Profit"
            value={k ? eur0(k.profit.value) : ""}
            note={k ? `${k.marginPercent.value >= 10 ? Math.round(k.marginPercent.value) : k.marginPercent.value.toFixed(1)}% margin` : undefined}
            trend={k?.profit}
            loading={!k}
            title={k ? `Revenue ${eur0(k.revenue.value)} − Yesim cost ${eur0(k.cost.value)} (margin ${pct(k.marginPercent.value)}).${est && est.profit !== 0 ? ` ${eur0(est.profit)} of it is estimated.` : ""}` : undefined}
          />
        </>
      ) : null}
      <KpiTile label="Data used" value={k ? gb(k.bytes.value) : ""} trend={k?.bytes} loading={!k} />
      <KpiTile label="Active eSIMs" value={k ? k.activeEsims.value.toLocaleString("en-GB") : ""} trend={k?.activeEsims} loading={!k} title="eSIMs that used data in the period" />
      <SupplyTile
        loading={!k}
        lines={
          k
            ? [
                ...(money
                  ? [
                      {
                        label: "Yesim balance",
                        value: eur0(k.supplier.balance),
                        note: days(k.supplier.runwayDays),
                        level: k.supplier.level,
                        href: "/esim/yesim",
                        title: `Lasts about ${Math.floor(k.supplier.runwayDays ?? 0)} days at the average Yesim cost of the last 7 days (${eur0(k.supplier.avgDailyCost)} a day). Amber below ${k.supplier.warnDays} days, red below ${k.supplier.criticalDays}.`,
                      },
                    ]
                  : []),
                {
                  label: "Free eSIMs",
                  value: String(k.stock.free),
                  note: days(k.stock.daysLeft),
                  level: k.stock.level,
                  href: "/esim/inventory",
                  title: `About ${k.stock.avgDailySales.toFixed(1)} eSIMs sold a day (last 30 days, as on Inventory). Amber below ${k.stock.warnDays} days, red below ${k.stock.criticalDays}.`,
                },
              ]
            : []
        }
      />
    </div>
  );

  const globe = (
    <LiveGlobeCard
      values={glow}
      format={cm === "bytes" ? gb : eur0}
      nameOf={(iso) => countryName(names, iso)}
      live={data?.live ?? null}
      generatedAt={data?.generatedAt ?? null}
      selected={focused}
      onSelect={focus}
      spotlight={spotlight}
      className="h-full"
    />
  );
  const chart = data ? (
    <ChartFill>
      <TrendChart
        title={chartMeasure === "data" ? "Data used" : "Revenue"}
        insight={insight.text}
        data={rows}
        segments={
          chartMeasure === "data"
            ? [{ key: "data", label: "Data used", color: "var(--primary)" }]
            : [
                { key: "cost", label: "Yesim cost", color: "var(--neutral)" },
                { key: "profit", label: "Profit", color: "var(--accent)" },
              ]
        }
        axisFormat={chartMeasure === "data" ? axisGb : axisEur}
        overflowFormat={chartMeasure === "data" ? axisGb : eurShort}
        average={insight.average}
        syncId={OVERVIEW_SYNC_ID}
        onSelect={openDay}
        selectHint={chartMeasure === "revenue" ? "Click to open it in Profit and costs" : "Click to open its usage"}
        switcher={money ? { value: measure, onChange: (v) => setMeasure(v as "revenue" | "data"), options: [["revenue", "Revenue"], ["data", "Data"]] as const } : undefined}
        tooltipRows={(r) => {
          if (chartMeasure === "data") return [{ label: "Data used", value: gbOf(r.total), color: "var(--primary)", strong: true }];
          const revenue = r.total;
          const profit = Number(r.realProfit);
          const prev = Number(r.previous);
          return [
            { label: "Revenue", value: eur2(revenue), strong: true },
            { label: "Yesim cost", value: eur2(Number(r.cost)), color: "var(--neutral)" },
            { label: "Profit", value: `${eur2(profit)} · ${revenue > 0 ? Math.round((profit / revenue) * 100) : 0}%`, color: "var(--accent)" },
            ...(q.compare && prev >= 0 ? [{ label: "Revenue, previous period", value: eur2(prev) }] : []),
          ];
        }}
      />
    </ChartFill>
  ) : (
    loadingCard
  );

  const resellerCols: Col<TenantOverview["resellers"][number]>[] = [
    { key: "name", header: "Reseller", align: "left", className: "w-[40%]", cell: (r) => <span title={r.name}>{r.name}</span> },
    {
      key: "rev",
      header: "Revenue",
      className: "w-[32%]",
      cell: (r) => (
        <>
          {eur0(r.revenue)} <span className="text-[11px]">{r.trend !== null ? <TrendText value={r.trend} /> : null}</span>
        </>
      ),
    },
    {
      key: "wallet",
      header: "Wallet",
      cell: (r) =>
        r.outstanding ? (
          <span className="text-danger" title={`Outstanding ${eur0(r.outstanding)}`}>
            −{eur0(r.outstanding)}
          </span>
        ) : r.available !== null ? (
          r.available < 100 ? eur2(r.available) : eur0(r.available)
        ) : (
          "–"
        ),
    },
  ];
  const planCols: Col<TenantOverview["plans"][number]>[] = [
    { key: "name", header: "Plan", align: "left", className: "w-[44%]", cell: (p) => p.name },
    { key: "sold", header: "Sold", cell: (p) => p.sold },
    ...(money ? [{ key: "rev", header: "Revenue", cell: (p: TenantOverview["plans"][number]) => eur0(p.revenue) }] : [{ key: "active", header: "Active", cell: (p: TenantOverview["plans"][number]) => p.active }]),
  ];
  const attention = data?.attention ?? [];
  const details = (
    <TabbedCard
      tabs={[{ key: "attention", label: "Needs attention", badge: attention.length, tone: "warning" }, { key: "plans", label: "Plans" }, ...(money ? [{ key: "resellers" as const, label: "Resellers" }] : [])]}
      value={tab}
      onChange={setTab}
      className="h-full"
    >
      {!data ? (
        <Skeleton className="h-full" />
      ) : tab === "attention" ? (
        <AttentionList items={attention} />
      ) : tab === "resellers" && money ? (
        <MiniTable rows={data.resellers} cols={resellerCols} rowKey={(r) => r.id} caption="Resellers by revenue" empty="No resellers in this scope" />
      ) : (
        <MiniTable rows={data.plans} cols={planCols} rowKey={(p) => p.id} caption="Plans sold and used" empty="No plans sold or used in this period" />
      )}
    </TabbedCard>
  );

  const topCountries = (
    <TopCountriesCard
      title={focused ? "Top countries · click one to switch" : "Top countries"}
      metric={cm}
      onMetric={setCountryMetric}
      metrics={money ? ([["revenue", "Revenue"], ["bytes", "Data"]] as const) : ([["bytes", "Data"]] as const)}
      rows={countries.map((c) => ({ iso2: c.iso2, name: c.name, value: cm === "bytes" ? c.bytes : c.revenue, display: cm === "bytes" ? gb(c.bytes) : eur0(c.revenue) }))}
      selected={focused}
      onSelect={focus}
      onOpen={(iso2) => router.push(openUsage({ country: iso2 }))}
      loading={!data}
      className="h-full"
    />
  );
  const networksCard = (
    <NetworksRankCard
      metric={nm}
      onMetric={setNetworkMetric}
      metrics={money ? ([["bytes", "Data"], ["cost", "Cost"], ["profit", "Profit"]] as const) : ([["bytes", "Data"]] as const)}
      rows={networks.map((n) => ({ id: n.id, label: shortOperator(n.operator, n.country), code: n.iso2, value: nm === "bytes" ? n.bytes : n[nm], display: nm === "bytes" ? gb(n.bytes) : eur0(n[nm]), href: openUsage({ network: n.id }) }))}
      moreHref={openUsage({})}
      loading={!data}
      className="h-full"
    />
  );

  const pm = money ? planMetric : "sold";
  const mix = planMix(data?.plans ?? [], (p) => (pm === "sold" ? p.sold : p.revenue), (p) => (money ? p.revenue : p.sold));
  const planCard = (
    <DonutCard
      title="Plan mix"
      slices={mix.slices}
      colorOf={mix.colorOf}
      format={pm === "sold" ? (v) => Math.round(v).toLocaleString("en-GB") : eur0}
      totalLabel={pm === "sold" ? "plans sold" : "revenue"}
      empty="No plans sold or used in this period"
      action={money ? <Seg label="Plan mix measure" value={planMetric} onChange={setPlanMetric} options={[["revenue", "Revenue"], ["sold", "Sold"]] as const} /> : undefined}
      className="h-full"
    />
  );

  return <Layout fit={fit} stale={stale} kpis={kpis} main={[globe, chart, details]} bottom={[topCountries, networksCard, planCard]} />;
}

// ---------------------------------------------------------------- reseller

function ResellerDashboard({ data, q, fit, stale, focus }: Shared & { data: ResellerOverview | null }) {
  const router = useRouter();
  const [measure, setMeasure] = useState<"spend" | "data">("spend");
  const [countryMetric, setCountryMetric] = useState<"spend" | "bytes">("spend");
  const [planMetric, setPlanMetric] = useState<"spend" | "sold">("spend");
  const [networkMetric, setNetworkMetric] = useState<"bytes" | "spend">("bytes");
  const [tab, setTab] = useState<"attention" | "plans" | "customers">("attention");
  const k = data?.kpis;
  const w = k?.wallet;
  const focused = q.iso2 ?? null;
  const per = q.granularity;
  const series = useMemo(() => data?.series ?? [], [data?.series]);
  const rows: TrendRow[] = useMemo(
    () =>
      series.map((b): TrendRow =>
        measure === "data"
          ? { bucket: b.bucket, label: axisLabel(b.bucket, per), estimated: b.estimated, total: b.bytes / GB, data: b.bytes / GB }
          : { bucket: b.bucket, label: axisLabel(b.bucket, per), estimated: b.estimated, total: b.spend, spend: b.spend, previous: b.previousSpend ?? -1 },
      ),
    [series, per, measure],
  );
  const insight = useMemo(() => trendInsight(rows, measure === "data" ? gbOf : eur0, per), [rows, measure, per]);
  const openUsage = (o: Record<string, string | null | undefined>) => `/esim/usage?${qs({ from: q.from, to: q.to, country: focused, ...o })}`;
  const openDay = (bucket: string) => {
    const [from, to] = bucketRange(bucket);
    router.push(`/esim/usage?${qs({ from, to, country: focused })}`);
  };
  const names = useMemo(() => new Map([...(data?.options.countries ?? []).map((c) => [c.iso2, c.name] as const), ...(data?.countries ?? []).map((c) => [c.iso2, c.name] as const)]), [data?.options.countries, data?.countries]);
  const worldCountries = useWorld(data?.countries ?? NONE, focused, stale);
  const countries = useMemo(() => [...worldCountries].sort((a, b) => (countryMetric === "bytes" ? b.bytes - a.bytes : b.spend - a.spend)), [worldCountries, countryMetric]);
  const glow = useMemo(() => Object.fromEntries(countries.map((c) => [c.iso2, countryMetric === "bytes" ? c.bytes : c.spend])), [countries, countryMetric]);
  const networks = useMemo(() => [...(data?.networks ?? [])].sort((a, b) => (networkMetric === "bytes" ? b.bytes - a.bytes : b.spend - a.spend)), [data?.networks, networkMetric]);
  const plansSold = (data?.plans ?? []).reduce((a, p) => a + p.sold, 0);

  const spotlight: Spotlight | null =
    focused && k && !stale
      ? {
          iso2: focused,
          name: countryName(names, focused),
          stats: [
            { label: "Spend", value: eur0(k.spend.value) },
            { label: "Data used", value: gb(k.bytes.value) },
            { label: "Active eSIMs", value: k.activeEsims.value.toLocaleString("en-GB") },
            { label: "Plans sold", value: plansSold.toLocaleString("en-GB") },
          ],
          href: openUsage({}),
        }
      : null;

  const kpis = (
    <div className="grid shrink-0 grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
      <KpiTile
        label="Spend"
        value={k ? eur0(k.spend.value) : ""}
        trend={k?.spend}
        goodWhenUp={false}
        note={k && k.estimatedSpend > 0 ? `incl. ${eurShort(k.estimatedSpend)} est.` : undefined}
        loading={!k}
        title={k ? `What your wallet paid for data in the period.${k.estimatedSpend > 0 ? ` ${eur0(k.estimatedSpend)} is estimated (provisional prices until tonight's report).` : ""}` : undefined}
      />
      <KpiTile label="Data used" value={k ? gb(k.bytes.value) : ""} trend={k?.bytes} loading={!k} />
      <KpiTile label="Active eSIMs" value={k ? k.activeEsims.value.toLocaleString("en-GB") : ""} trend={k?.activeEsims} loading={!k} title="eSIMs that used data in the period" />
      <KpiTile label="Plans sold" value={data ? plansSold.toLocaleString("en-GB") : ""} loading={!k} title="New eSIMs and added plans in the period" />
      <KpiTile
        label="Available balance"
        value={w ? eur2(w.available) : ""}
        note={w ? (w.outstanding > 0 ? `${eur0(w.outstanding)} owed` : days(w.runwayDays)) : undefined}
        level={w?.level}
        href="/esim/wallet"
        loading={!k}
        title={w ? `At your average spend of the last 7 days (${eur0(w.avgDailySpend)} a day). Warning below ${eur0(w.lowThreshold)}.` : undefined}
      />
    </div>
  );
  const globe = (
    <LiveGlobeCard
      values={glow}
      format={countryMetric === "bytes" ? gb : eur0}
      nameOf={(iso) => countryName(names, iso)}
      live={data?.live ?? null}
      generatedAt={data?.generatedAt ?? null}
      selected={focused}
      onSelect={focus}
      spotlight={spotlight}
      className="h-full"
    />
  );
  const chart = data ? (
    <ChartFill>
      <TrendChart
        title={measure === "data" ? "Data used" : "Spend"}
        insight={insight.text}
        data={rows}
        segments={[measure === "data" ? { key: "data", label: "Data used", color: "var(--primary)" } : { key: "spend", label: "Spend", color: "var(--accent)" }]}
        axisFormat={measure === "data" ? axisGb : axisEur}
        overflowFormat={measure === "data" ? axisGb : eurShort}
        average={insight.average}
        syncId={OVERVIEW_SYNC_ID}
        onSelect={openDay}
        selectHint="Click to open its usage"
        switcher={{ value: measure, onChange: (v) => setMeasure(v as "spend" | "data"), options: [["spend", "Spend"], ["data", "Data"]] as const }}
        tooltipRows={(r) => {
          if (measure === "data") return [{ label: "Data used", value: gbOf(r.total), color: "var(--primary)", strong: true }];
          const prev = Number(r.previous);
          return [{ label: "Spend", value: eur2(r.total), color: "var(--accent)", strong: true }, ...(q.compare && prev >= 0 ? [{ label: "Previous period", value: eur2(prev) }] : [])];
        }}
      />
    </ChartFill>
  ) : (
    loadingCard
  );
  const planCols: Col<ResellerOverview["plans"][number]>[] = [
    { key: "name", header: "Plan", align: "left", className: "w-[44%]", cell: (p) => p.name },
    { key: "sold", header: "Sold", cell: (p) => p.sold },
    { key: "spend", header: "Spend", cell: (p) => eur0(p.spend) },
  ];
  const customerCols: Col<ResellerOverview["customers"][number]>[] = [
    { key: "name", header: "Customer", align: "left", className: "w-[48%]", cell: (c) => c.name },
    { key: "esims", header: "eSIMs", cell: (c) => c.esims },
    { key: "spend", header: "Spend", cell: (c) => eur0(c.spend) },
  ];
  const attention = data?.attention ?? [];
  const details = (
    <TabbedCard
      tabs={[
        { key: "attention", label: "Needs attention", badge: attention.length, tone: "warning" },
        { key: "plans", label: "Plans" },
        { key: "customers", label: "Customers" },
      ]}
      value={tab}
      onChange={setTab}
      className="h-full"
    >
      {!data ? (
        <Skeleton className="h-full" />
      ) : tab === "attention" ? (
        <AttentionList items={attention} />
      ) : tab === "plans" ? (
        <MiniTable rows={data.plans} cols={planCols} rowKey={(p) => p.id} caption="Your plans" empty="No plans sold or used in this period" />
      ) : (
        <MiniTable rows={data.customers} cols={customerCols} rowKey={(c) => c.id} caption="Top customers by spend" empty="No customer usage in this period" />
      )}
    </TabbedCard>
  );
  const topCountries = (
    <TopCountriesCard
      title={focused ? "Top countries · click one to switch" : "Top countries"}
      metric={countryMetric}
      onMetric={setCountryMetric}
      metrics={[["spend", "Spend"], ["bytes", "Data"]] as const}
      rows={countries.map((c) => ({ iso2: c.iso2, name: c.name, value: countryMetric === "bytes" ? c.bytes : c.spend, display: countryMetric === "bytes" ? gb(c.bytes) : eur0(c.spend) }))}
      selected={focused}
      onSelect={focus}
      onOpen={(iso2) => router.push(openUsage({ country: iso2 }))}
      loading={!data}
      className="h-full"
    />
  );
  const networksCard = (
    <NetworksRankCard
      metric={networkMetric}
      onMetric={setNetworkMetric}
      metrics={[["bytes", "Data"], ["spend", "Spend"]] as const}
      rows={networks.map((n) => ({ id: n.id, label: shortOperator(n.operator, n.country), code: n.iso2, value: networkMetric === "bytes" ? n.bytes : n.spend, display: networkMetric === "bytes" ? gb(n.bytes) : eur0(n.spend), href: openUsage({ network: n.id }) }))}
      moreHref={openUsage({})}
      loading={!data}
      className="h-full"
    />
  );
  const mix = planMix(data?.plans ?? [], (p) => (planMetric === "sold" ? p.sold : p.spend), (p) => p.spend);
  const planCard = (
    <DonutCard
      title="Plan mix"
      slices={mix.slices}
      colorOf={mix.colorOf}
      format={planMetric === "sold" ? (v) => Math.round(v).toLocaleString("en-GB") : eur0}
      totalLabel={planMetric === "sold" ? "plans sold" : "spend"}
      empty="No plans sold or used in this period"
      action={<Seg label="Plan mix measure" value={planMetric} onChange={setPlanMetric} options={[["spend", "Spend"], ["sold", "Sold"]] as const} />}
      className="h-full"
    />
  );
  return <Layout fit={fit} stale={stale} kpis={kpis} main={[globe, chart, details]} bottom={[topCountries, networksCard, planCard]} />;
}
