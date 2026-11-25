"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { DonutCard, colorMap, type DonutSlice } from "@/components/platform/charts/donut-card";
import { ChartFill } from "@/components/platform/charts/chart-kit";
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
  OverviewFilterBar,
  pct,
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
const shortOperator = (operator: string, country: string) => operator.replace(new RegExp(`\\s*${country}.*$`), "") || operator;
const regionNames = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["en-GB"], { type: "region" }) : null;
/** A country's name: ours first, else the browser's (any country on the globe). */
const countryName = (names: Map<string, string>, iso2: string) => names.get(iso2) ?? regionNames?.of(iso2) ?? iso2;

/**
 * Dashboard (spec 8.1; reworked 2026-11): seven slim KPIs, a live globe,
 * data and money per day, network donuts, top countries, and one card for
 * Needs attention, plans and resellers. Clicking a country (globe or list)
 * focuses every card on it. Resellers and assistants see their own scope at
 * their price; never Yesim cost or profit.
 * One screen on desktop (1440×900 and 1366×768); stacked below that.
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
  const pickNetwork = useCallback((networkId: string | null) => setF((x) => ({ ...x, networkId })), []);

  const body =
    data?.scope === "reseller" || (!data && !tenant) ? (
      <ResellerDashboard data={data?.scope === "reseller" ? data : null} q={q} fit={fit} stale={stale} focus={focus} pickNetwork={pickNetwork} />
    ) : (
      <TenantDashboard data={data?.scope === "tenant" ? data : null} q={q} fit={fit} stale={stale} focus={focus} pickNetwork={pickNetwork} />
    );
  return (
    <div className={cn("flex flex-col gap-2.5", fit ? "h-[calc(100dvh-104px)] min-h-[560px]" : "pb-6")}>
      <h1 className="sr-only">Dashboard</h1>
      <OverviewFilterBar value={f} onChange={setF} options={data?.options ?? null} tenant={tenant} />
      {body}
    </div>
  );
}

type Shared = { q: OverviewQuery; fit: boolean; stale: boolean; focus: (iso2: string | null) => void; pickNetwork: (id: string | null) => void };

/** KPIs, then [live | data | money] and [donuts | countries | tabs]; dims while a filter change loads. */
function Layout({ fit, stale, kpis, top, bottom }: { fit: boolean; stale: boolean; kpis: ReactNode; top: ReactNode[]; bottom: ReactNode[] }) {
  const cols = (n: number) => (n === 2 ? "lg:grid-cols-[1fr_2fr]" : n === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4");
  const dim = cn("transition-opacity duration-200", stale && "opacity-60");
  if (!fit)
    return (
      <div className={cn("flex flex-col gap-3", dim)} aria-busy={stale || undefined}>
        {kpis}
        <div className="grid gap-3 sm:grid-cols-2">
          {[...top, ...bottom].map((n, i) => (
            <div key={i} className="h-[300px] min-w-0">
              {n}
            </div>
          ))}
        </div>
      </div>
    );
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-2.5", dim)} aria-busy={stale || undefined}>
      {kpis}
      <div className={cn("grid min-h-0 flex-1 gap-2.5", cols(top.length))}>
        {top.map((n, i) => (
          <div key={i} className="min-h-0 min-w-0">
            {n}
          </div>
        ))}
      </div>
      <div className={cn("grid min-h-0 flex-[1.1] gap-2.5", cols(bottom.length))}>
        {bottom.map((n, i) => (
          <div key={i} className="min-h-0 min-w-0">
            {n}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The same six networks in both donuts (biggest combined share of the two measures), so colours match. */
function featuredNetworks<T extends { id: string }>(rows: T[], a: (r: T) => number, b: (r: T) => number) {
  const ta = rows.reduce((s, r) => s + a(r), 0) || 1;
  const tb = rows.reduce((s, r) => s + b(r), 0) || 1;
  return [...rows].sort((x, y) => a(y) / ta + b(y) / tb - (a(x) / ta + b(x) / tb)).slice(0, 6).map((r) => r.id);
}
function sliceFor<T extends { id: string; operator: string; iso2: string; country: string }>(rows: T[], keys: string[], v: (r: T) => number): DonutSlice[] {
  const keep = new Set(keys);
  const top = rows.filter((r) => keep.has(r.id)).map((r) => ({ key: r.id, label: shortOperator(r.operator, r.country), sub: r.iso2, value: v(r) }));
  const other = rows.filter((r) => !keep.has(r.id));
  const otherValue = other.reduce((s, r) => s + v(r), 0);
  // largest first, "Other" always last
  const sorted = top.sort((x, y) => y.value - x.value);
  return otherValue > 0 ? [...sorted, { key: "other", label: "Other", sub: `${other.length} networks`, value: otherValue }] : sorted;
}

const loadingCard = <Skeleton className="h-full min-h-[200px] rounded-card" />;

// ------------------------------------------------------------------- admin

type CountryMetric = "revenue" | "bytes";
const COUNTRY_METRICS = [
  ["revenue", "Revenue"],
  ["bytes", "Data"],
] as const;

function TenantDashboard({ data, q, fit, stale, focus, pickNetwork }: Shared & { data: TenantOverview | null }) {
  const router = useRouter();
  const money = data?.money ?? true;
  const [countryMetric, setCountryMetric] = useState<CountryMetric>("revenue");
  const [tab, setTab] = useState<"attention" | "plans" | "resellers">("attention");
  const cm: CountryMetric = money ? countryMetric : "bytes";
  const k = data?.kpis;
  const reseller = q.resellerId ?? null;
  const focused = q.iso2 ?? null;
  const series = useMemo(() => data?.series ?? [], [data?.series]);
  const per = q.granularity;

  // ---- trends: data used, and revenue as Yesim cost + profit
  const dataRows: TrendRow[] = useMemo(() => series.map((b) => ({ bucket: b.bucket, label: axisLabel(b.bucket, per), estimated: b.estimated, total: b.bytes / GB, data: b.bytes / GB })), [series, per]);
  const moneyRows: TrendRow[] = useMemo(
    () =>
      series.map((b) => ({
        bucket: b.bucket,
        label: axisLabel(b.bucket, per),
        estimated: b.estimated,
        total: b.revenue,
        cost: b.cost,
        profit: Math.max(0, b.profit),
        realProfit: b.profit,
        previous: b.previousRevenue ?? -1,
      })),
    [series, per],
  );
  const dataInsight = useMemo(() => trendInsight(dataRows, gbOf, per), [dataRows, per]);
  const moneyInsight = useMemo(() => trendInsight(moneyRows, eur0, per), [moneyRows, per]);

  const openDay = (bucket: string) => {
    const [from, to] = bucketRange(bucket);
    router.push(money ? `/esim/profit?${qs({ from, to, reseller })}` : `/esim/usage?${qs({ from, to, reseller, country: focused })}`);
  };
  const openUsageDay = (bucket: string) => {
    const [from, to] = bucketRange(bucket);
    router.push(`/esim/usage?${qs({ from, to, reseller, country: focused })}`);
  };
  const openCountry = (iso2: string) => router.push(`/esim/usage?${qs({ country: iso2, from: q.from, to: q.to, reseller })}`);

  // ---- countries (and, with a country in focus, its networks)
  const countries = useMemo(() => [...(data?.countries ?? [])].sort((a, b) => (cm === "bytes" ? b.bytes - a.bytes : b.revenue - a.revenue)), [data?.countries, cm]);
  const glow = useMemo(() => Object.fromEntries(countries.map((c) => [c.iso2, cm === "bytes" ? c.bytes : c.revenue])), [countries, cm]);
  // the globe keeps the world view while a country is in focus (so another country can be picked)
  const [world, setWorld] = useState(glow);
  if (!focused && !stale && glow !== world) setWorld(glow);
  const globeValues = focused ? world : glow;
  const names = useMemo(() => new Map([...(data?.options.countries ?? []).map((c) => [c.iso2, c.name] as const), ...(data?.countries ?? []).map((c) => [c.iso2, c.name] as const)]), [data?.options.countries, data?.countries]);
  const networks = useMemo(() => data?.networks ?? [], [data?.networks]);
  const featured = useMemo(() => (money ? featuredNetworks(networks, (n) => n.bytes, (n) => n.cost) : featuredNetworks(networks, (n) => n.bytes, (n) => n.bytes)), [networks, money]);
  const colors = useMemo(() => colorMap(featured), [featured]);
  const colorOf = useCallback((key: string) => colors.get(key) ?? "var(--series-other)", [colors]);
  const volumeSlices = useMemo(() => sliceFor(networks, featured, (n) => n.bytes), [networks, featured]);
  const costSlices = useMemo(() => sliceFor(networks, featured, (n) => n.cost), [networks, featured]);

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
          href: `/esim/usage?${qs({ country: focused, from: q.from, to: q.to, reseller })}`,
        }
      : null;

  const kpis = (
    <div className={cn("grid shrink-0 grid-cols-2 gap-2.5 sm:grid-cols-4", money ? "lg:grid-cols-7" : "lg:grid-cols-4")}>
      {money ? (
        <>
          <KpiTile label="Revenue" value={k ? eur0(k.revenue.value) : ""} trend={k?.revenue} loading={!k} title={k?.revenue.previous != null ? `Previous period ${eur0(k.revenue.previous)}` : "Reseller charges and direct sales"} />
          <KpiTile label="Yesim cost" value={k ? eur0(k.cost.value) : ""} trend={k?.cost} goodWhenUp={false} loading={!k} title="What we pay Yesim for the data used" />
          <KpiTile label="Profit" value={k ? eur0(k.profit.value) : ""} note={k ? `${k.marginPercent.value >= 10 ? Math.round(k.marginPercent.value) : k.marginPercent.value.toFixed(1)}%` : undefined} trend={k?.profit} loading={!k} title={k ? `Margin ${pct(k.marginPercent.value)}` : undefined} />
        </>
      ) : null}
      <KpiTile label="Data used" value={k ? gb(k.bytes.value) : ""} trend={k?.bytes} loading={!k} />
      <KpiTile label="Active eSIMs" value={k ? k.activeEsims.value.toLocaleString("en-GB") : ""} trend={k?.activeEsims} loading={!k} title="eSIMs that used data in the period" />
      {money ? (
        <KpiTile
          label="Yesim balance"
          value={k ? eur0(k.supplier.balance) : ""}
          note={k ? days(k.supplier.runwayDays) : undefined}
          level={k?.supplier.level}
          href="/esim/yesim"
          loading={!k}
          title={k ? `Lasts about ${Math.floor(k.supplier.runwayDays ?? 0)} days at the average Yesim cost of the last 7 days (${eur0(k.supplier.avgDailyCost)} a day). Amber below ${k.supplier.warnDays} days, red below ${k.supplier.criticalDays}.` : undefined}
        />
      ) : null}
      <KpiTile
        label="Free eSIMs"
        value={k ? String(k.stock.free) : ""}
        note={k ? days(k.stock.daysLeft) : undefined}
        level={k?.stock.level}
        href="/esim/inventory"
        loading={!k}
        title={k ? `About ${k.stock.avgDailySales.toFixed(1)} eSIMs sold a day (last 30 days, as on Inventory). Amber below ${k.stock.warnDays} days, red below ${k.stock.criticalDays}.` : undefined}
      />
    </div>
  );

  const live = (
    <LiveGlobeCard
      values={globeValues}
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
  const dataChart = data ? (
    <ChartFill>
      <TrendChart
        title="Data used"
        insight={dataInsight.text}
        data={dataRows}
        segments={[{ key: "data", label: "Data used", color: "var(--primary)" }]}
        axisFormat={axisGb}
        average={dataInsight.average}
        syncId={OVERVIEW_SYNC_ID}
        onSelect={openUsageDay}
        selectHint="Click to open its usage"
        tooltipRows={(r) => [{ label: "Data used", value: gbOf(r.total), color: "var(--primary)", strong: true }]}
      />
    </ChartFill>
  ) : (
    loadingCard
  );
  const moneyChart = data ? (
    <ChartFill>
      <TrendChart
        title="Revenue"
        insight={moneyInsight.text}
        data={moneyRows}
        segments={[
          { key: "cost", label: "Yesim cost", color: "var(--neutral)" },
          { key: "profit", label: "Profit", color: "var(--accent)" },
        ]}
        axisFormat={axisEur}
        average={moneyInsight.average}
        syncId={OVERVIEW_SYNC_ID}
        onSelect={openDay}
        selectHint="Click to open it in Profit and costs"
        tooltipRows={(r) => {
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

  const donutVolume = data ? <DonutCard title="Networks · data used" slices={volumeSlices} colorOf={colorOf} format={gb} totalLabel="total" className="h-full" /> : loadingCard;
  const donutCost = data ? <DonutCard title="Networks · Yesim cost" slices={costSlices} colorOf={colorOf} format={eur0} totalLabel="total" className="h-full" /> : loadingCard;

  const ranked = focused ? (
    <TopCountriesCard
      title={`Networks in ${countryName(names, focused)}`}
      selectLabel="Narrow the dashboard to this network"
      metric={cm}
      onMetric={setCountryMetric}
      metrics={money ? COUNTRY_METRICS : ([["bytes", "Data"]] as const)}
      rows={[...networks]
        .sort((a, b) => (cm === "bytes" ? b.bytes - a.bytes : b.revenue - a.revenue))
        .map((n) => ({ iso2: n.id, name: shortOperator(n.operator, n.country), value: cm === "bytes" ? n.bytes : n.revenue, display: cm === "bytes" ? gb(n.bytes) : eur0(n.revenue), flag: null }))}
      selected={q.networkId ?? null}
      onSelect={pickNetwork}
      onOpen={() => openCountry(focused)}
      loading={!data}
      className="h-full"
    />
  ) : (
    <TopCountriesCard
      metric={cm}
      onMetric={setCountryMetric}
      metrics={money ? COUNTRY_METRICS : ([["bytes", "Data"]] as const)}
      rows={countries.map((c) => ({ iso2: c.iso2, name: c.name, value: cm === "bytes" ? c.bytes : c.revenue, display: cm === "bytes" ? gb(c.bytes) : eur0(c.revenue) }))}
      selected={null}
      onSelect={focus}
      onOpen={openCountry}
      loading={!data}
      className="h-full"
    />
  );

  const resellerCols: Col<TenantOverview["resellers"][number]>[] = [
    { key: "name", header: "Reseller", align: "left", className: "w-[36%]", cell: (r) => <span title={r.name}>{r.name}</span> },
    {
      key: "rev",
      header: "Revenue",
      className: "w-[30%]",
      cell: (r) => (
        <>
          {eur0(r.revenue)} <span className="text-[11px]">{r.trend !== null ? <TrendText value={r.trend} /> : null}</span>
        </>
      ),
    },
    { key: "profit", header: "Profit", cell: (r) => eur0(r.profit) },
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
    { key: "name", header: "Plan", align: "left", className: "w-[40%]", cell: (p) => p.name },
    { key: "sold", header: "Sold", cell: (p) => p.sold },
    { key: "active", header: "Active", cell: (p) => p.active },
    ...(money ? [{ key: "rev", header: "Revenue", cell: (p: TenantOverview["plans"][number]) => eur0(p.revenue) }] : []),
  ];
  const attention = data?.attention ?? [];
  const tabs = [
    { key: "attention" as const, label: "Needs attention", badge: attention.length, tone: "warning" as const },
    { key: "plans" as const, label: "Plans" },
    ...(money ? [{ key: "resellers" as const, label: "Resellers" }] : []),
  ];
  const details = (
    <TabbedCard tabs={tabs} value={tab} onChange={setTab} className="h-full">
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

  return (
    <Layout
      fit={fit}
      stale={stale}
      kpis={kpis}
      top={money ? [live, dataChart, moneyChart] : [live, dataChart]}
      bottom={money ? [donutVolume, donutCost, ranked, details] : [donutVolume, ranked, details]}
    />
  );
}

// ---------------------------------------------------------------- reseller

type ResellerCountry = "spend" | "bytes";
const RESELLER_COUNTRY = [
  ["spend", "Spend"],
  ["bytes", "Data"],
] as const;

function ResellerDashboard({ data, q, fit, stale, focus, pickNetwork }: Shared & { data: ResellerOverview | null }) {
  const router = useRouter();
  const [countryMetric, setCountryMetric] = useState<ResellerCountry>("spend");
  const [tab, setTab] = useState<"attention" | "plans" | "customers">("attention");
  const k = data?.kpis;
  const w = k?.wallet;
  const focused = q.iso2 ?? null;
  const per = q.granularity;
  const series = useMemo(() => data?.series ?? [], [data?.series]);
  const dataRows: TrendRow[] = useMemo(() => series.map((b) => ({ bucket: b.bucket, label: axisLabel(b.bucket, per), estimated: b.estimated, total: b.bytes / GB, data: b.bytes / GB })), [series, per]);
  const spendRows: TrendRow[] = useMemo(() => series.map((b) => ({ bucket: b.bucket, label: axisLabel(b.bucket, per), estimated: b.estimated, total: b.spend, spend: b.spend, previous: b.previousSpend ?? -1 })), [series, per]);
  const dataInsight = useMemo(() => trendInsight(dataRows, gbOf, per), [dataRows, per]);
  const spendInsight = useMemo(() => trendInsight(spendRows, eur0, per), [spendRows, per]);
  const openDay = (bucket: string) => {
    const [from, to] = bucketRange(bucket);
    router.push(`/esim/usage?${qs({ from, to, country: focused })}`);
  };
  const openCountry = (iso2: string) => router.push(`/esim/usage?${qs({ country: iso2, from: q.from, to: q.to })}`);
  const countries = useMemo(() => [...(data?.countries ?? [])].sort((a, b) => (countryMetric === "bytes" ? b.bytes - a.bytes : b.spend - a.spend)), [data?.countries, countryMetric]);
  const glow = useMemo(() => Object.fromEntries(countries.map((c) => [c.iso2, countryMetric === "bytes" ? c.bytes : c.spend])), [countries, countryMetric]);
  // the globe keeps the world view while a country is in focus (so another country can be picked)
  const [world, setWorld] = useState(glow);
  if (!focused && !stale && glow !== world) setWorld(glow);
  const globeValues = focused ? world : glow;
  const names = useMemo(() => new Map([...(data?.options.countries ?? []).map((c) => [c.iso2, c.name] as const), ...(data?.countries ?? []).map((c) => [c.iso2, c.name] as const)]), [data?.options.countries, data?.countries]);
  const networks = useMemo(() => data?.networks ?? [], [data?.networks]);
  const featured = useMemo(() => featuredNetworks(networks, (n) => n.bytes, (n) => n.spend), [networks]);
  const colors = useMemo(() => colorMap(featured), [featured]);
  const colorOf = useCallback((key: string) => colors.get(key) ?? "var(--series-other)", [colors]);
  const volumeSlices = useMemo(() => sliceFor(networks, featured, (n) => n.bytes), [networks, featured]);
  const spendSlices = useMemo(() => sliceFor(networks, featured, (n) => n.spend), [networks, featured]);
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
          href: `/esim/usage?${qs({ country: focused, from: q.from, to: q.to })}`,
        }
      : null;

  const kpis = (
    <div className="grid shrink-0 grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
      <KpiTile label="Spend" value={k ? eur0(k.spend.value) : ""} trend={k?.spend} goodWhenUp={false} loading={!k} title="What your wallet paid for data in the period" />
      <KpiTile
        label="Available balance"
        value={w ? eur2(w.available) : ""}
        note={w ? (w.outstanding > 0 ? `${eur0(w.outstanding)} owed` : days(w.runwayDays)) : undefined}
        level={w?.level}
        href="/esim/wallet"
        loading={!k}
        title={w ? `At your average spend of the last 7 days (${eur0(w.avgDailySpend)} a day). Warning below ${eur0(w.lowThreshold)}.` : undefined}
      />
      <KpiTile label="Data used" value={k ? gb(k.bytes.value) : ""} trend={k?.bytes} loading={!k} />
      <KpiTile label="Active eSIMs" value={k ? k.activeEsims.value.toLocaleString("en-GB") : ""} trend={k?.activeEsims} loading={!k} title="eSIMs that used data in the period" />
      <KpiTile label="Plans sold" value={data ? plansSold.toLocaleString("en-GB") : ""} loading={!k} title="New eSIMs and added plans in the period" />
      <KpiTile label="Customers" value={k ? k.customers.toLocaleString("en-GB") : ""} loading={!k} href="/esim/customers" />
    </div>
  );
  const live = (
    <LiveGlobeCard
      values={globeValues}
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
  const dataChart = data ? (
    <ChartFill>
      <TrendChart
        title="Data used"
        insight={dataInsight.text}
        data={dataRows}
        segments={[{ key: "data", label: "Data used", color: "var(--primary)" }]}
        axisFormat={axisGb}
        average={dataInsight.average}
        syncId={OVERVIEW_SYNC_ID}
        onSelect={openDay}
        selectHint="Click to open its usage"
        tooltipRows={(r) => [{ label: "Data used", value: gbOf(r.total), color: "var(--primary)", strong: true }]}
      />
    </ChartFill>
  ) : (
    loadingCard
  );
  const spendChart = data ? (
    <ChartFill>
      <TrendChart
        title="Spend"
        insight={spendInsight.text}
        data={spendRows}
        segments={[{ key: "spend", label: "Spend", color: "var(--accent)" }]}
        axisFormat={axisEur}
        average={spendInsight.average}
        syncId={OVERVIEW_SYNC_ID}
        onSelect={openDay}
        selectHint="Click to open its usage"
        tooltipRows={(r) => {
          const prev = Number(r.previous);
          return [{ label: "Spend", value: eur2(r.total), color: "var(--accent)", strong: true }, ...(q.compare && prev >= 0 ? [{ label: "Previous period", value: eur2(prev) }] : [])];
        }}
      />
    </ChartFill>
  ) : (
    loadingCard
  );
  const donutVolume = data ? <DonutCard title="Networks · data used" slices={volumeSlices} colorOf={colorOf} format={gb} totalLabel="total" className="h-full" /> : loadingCard;
  const donutSpend = data ? <DonutCard title="Networks · spend" slices={spendSlices} colorOf={colorOf} format={eur0} totalLabel="total" className="h-full" /> : loadingCard;
  const ranked = focused ? (
    <TopCountriesCard
      title={`Networks in ${countryName(names, focused)}`}
      selectLabel="Narrow the dashboard to this network"
      metric={countryMetric}
      onMetric={setCountryMetric}
      metrics={RESELLER_COUNTRY}
      rows={[...networks]
        .sort((a, b) => (countryMetric === "bytes" ? b.bytes - a.bytes : b.spend - a.spend))
        .map((n) => ({ iso2: n.id, name: shortOperator(n.operator, n.country), value: countryMetric === "bytes" ? n.bytes : n.spend, display: countryMetric === "bytes" ? gb(n.bytes) : eur0(n.spend), flag: null }))}
      selected={q.networkId ?? null}
      onSelect={pickNetwork}
      onOpen={() => openCountry(focused)}
      loading={!data}
      className="h-full"
    />
  ) : (
    <TopCountriesCard
      metric={countryMetric}
      onMetric={setCountryMetric}
      metrics={RESELLER_COUNTRY}
      rows={countries.map((c) => ({ iso2: c.iso2, name: c.name, value: countryMetric === "bytes" ? c.bytes : c.spend, display: countryMetric === "bytes" ? gb(c.bytes) : eur0(c.spend) }))}
      selected={null}
      onSelect={focus}
      onOpen={openCountry}
      loading={!data}
      className="h-full"
    />
  );
  const planCols: Col<ResellerOverview["plans"][number]>[] = [
    { key: "name", header: "Plan", align: "left", className: "w-[40%]", cell: (p) => p.name },
    { key: "sold", header: "Sold", cell: (p) => p.sold },
    { key: "active", header: "Active", cell: (p) => p.active },
    { key: "spend", header: "Spend", cell: (p) => eur0(p.spend) },
  ];
  const customerCols: Col<ResellerOverview["customers"][number]>[] = [
    { key: "name", header: "Customer", align: "left", className: "w-[44%]", cell: (c) => c.name },
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
  return <Layout fit={fit} stale={stale} kpis={kpis} top={[live, dataChart, spendChart]} bottom={[donutVolume, donutSpend, ranked, details]} />;
}
