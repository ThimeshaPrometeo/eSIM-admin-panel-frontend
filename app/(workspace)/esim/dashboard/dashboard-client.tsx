"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CountryBar, MonthlyBarChart, PlansSoldChart, RevenueProfitChart, StatusDonut, TopEsimsBar, TransactionsChart, UsageAreaChart, usageSeries } from "@/components/platform/charts/charts";
import { ChartFill, ChartFrame } from "@/components/platform/charts/chart-kit";
import { Skeleton } from "@/components/ui/skeleton";
import { PeriodSelect, ResellerSelect, UnitSelect } from "@/components/platform/fields";
import { StatBlock } from "@/components/platform/primitives";
import { Reveal } from "@/components/platform/motion/reveal";
import { LiveGlobe, LiveShaderBackground } from "@/components/platform/three/lazy";
import { usePlatform } from "@/contexts/platform-context";
import { useResource } from "@/hooks/use-resource";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { dashboardApi } from "@/lib/api/dashboard";
import { formatAxisDate } from "@/lib/platform/dates";
import { formatMoney, toNumber } from "@/lib/platform/money";
import { can } from "@/lib/platform/permissions";
import { periodFor, PERIOD_LABELS, type Period } from "@/lib/platform/period";
import { toUnit, type DataUnit } from "@/lib/platform/units";

const HOME = "LK"; // the tenant's home country (Asia/Colombo); arcs start here

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Colombo" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** Dashboard (spec 8.1): charts only, in the viewer's scope and period. */
export function DashboardClient() {
  const { me } = usePlatform();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>(() => periodFor("30d"));
  const [unit, setUnit] = useState<DataUnit>("GB");
  const [resellerId, setResellerId] = useState<string | null>(null);
  const tenant = me?.role === "admin" || me?.role === "staff";
  const { data } = useResource(() => dashboardApi.getDashboard(period, { resellerId }), [period.from, period.to, period.granularity, resellerId]);

  const label = (b: string) => formatAxisDate(b.length === 4 ? `${b}-01-01` : b.length === 7 ? `${b}-01` : b, period.granularity);
  const v = (bytes: number) => Math.round(toUnit(bytes, unit) * 100) / 100;

  const usage = useMemo(
    () => usageSeries((data?.usage ?? []).map((u) => ({ label: label(u.bucket), value: v(u.finalBytes + u.estimatedBytes), estimated: u.estimatedBytes > 0 }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, unit, period.granularity],
  );

  const statusTone = { active: "accent", pending: "primary", suspended: "danger", expired: "neutral", in_stock: "warning" } as const;
  const statusLabel = { active: "Active", pending: "Waiting to start", suspended: "Suspended", expired: "Expired", in_stock: "In stock" } as const;
  const showRevenue = !!data?.revenue && can(me?.permissions, "profit_reports");
  const delta = (now: number, before: number) => (before > 0 ? (now - before) / before : undefined);
  const firstName = me?.fullName.split(" ")[0] ?? "";
  // one-screen layout needs room for a 4 × 2 grid of charts
  const fit = useMediaQuery("(min-width: 1280px) and (min-height: 640px)");
  const [usageView, setUsageView] = useState<"period" | "monthly">("period");
  const [moneyView, setMoneyView] = useState<"transactions" | "revenue">("transactions");

  const charts = data
    ? {
        usage: <UsageAreaChart data={usage} unit={unit} title="Data usage" description={`${unit} per ${period.granularity}; dashed = estimated until the nightly report`} />,
        monthly: <MonthlyBarChart data={data.monthly.map((m) => ({ label: formatAxisDate(`${m.month}-01`, "month"), value: v(m.bytes) }))} unit={unit} />,
        // the centre shows sold eSIMs (= Total eSIMs above); stock is a slice of its own
        status: (
          <StatusDonut
            data={data.status.filter((s) => s.count > 0).map((s) => ({ label: statusLabel[s.key], value: s.count, tone: statusTone[s.key] }))}
            total={data.stats.totalEsims}
            totalLabel="sold eSIMs"
          />
        ),
        plans: <PlansSoldChart data={(fit ? data.plansSold.slice(0, 6) : data.plansSold).map((p) => ({ label: p.name, value: p.count }))} />,
        transactions: <TransactionsChart data={data.transactions.map((t) => ({ label: label(t.bucket), credits: t.credits, debits: t.debits }))} />,
        top: <TopEsimsBar data={data.topEsims.map((e) => ({ id: e.id, label: `…${e.iccid.slice(-8)}`, value: v(e.bytes) }))} unit={unit} onSelect={(id) => router.push(`/esim/esims/${id}`)} />,
        country: <CountryBar data={data.byCountry.map((c) => ({ label: c.country, value: v(c.bytes) }))} unit={unit} />,
        revenue: showRevenue && data.revenue ? <RevenueProfitChart data={data.revenue.map((r) => ({ label: label(r.bucket), revenue: r.revenue, cost: r.cost, profit: r.profit }))} /> : null,
      }
    : null;

  const toolbar = (
    <div className={cn("flex flex-wrap items-center gap-2", fit && "justify-end")}>
      <PeriodSelect value={period} onChange={setPeriod} />
      <UnitSelect value={unit} onChange={setUnit} />
      {tenant ? <ResellerSelect value={resellerId} onChange={setResellerId} className="sm:w-44" /> : null}
    </div>
  );

  const statSize = fit ? ("sm" as const) : undefined;
  const stats = (
    <>
      <StatBlock size={statSize} label="Total eSIMs" value={data?.stats.totalEsims ?? 0} loading={!data} />
      <StatBlock size={statSize} label="Active eSIMs" value={data?.stats.activeEsims ?? 0} loading={!data} />
      <StatBlock
        size={statSize}
        label="Data used"
        value={data ? v(data.stats.dataUsedBytes) : 0}
        format={(n) => `${n.toLocaleString("en-GB", { maximumFractionDigits: unit === "MB" ? 0 : 1 })} ${unit}`}
        delta={data ? delta(data.stats.dataUsedBytes, data.stats.previous.dataUsedBytes) : undefined}
        hint={fit ? undefined : "vs previous period"}
        loading={!data}
      />
      {data?.stats.available !== null && data?.stats.available !== undefined ? (
        <StatBlock size={statSize} label="Available balance" value={toNumber(data.stats.available)} format={(n) => formatMoney(n)} loading={!data} />
      ) : showRevenue ? (
        <StatBlock size={statSize} label="Revenue" value={toNumber(data?.stats.revenue)} format={(n) => formatMoney(n)} delta={data ? delta(toNumber(data.stats.revenue), toNumber(data.stats.previous.revenue)) : undefined} loading={!data} />
      ) : null}
    </>
  );

  const arcs = (data?.recentCountries ?? []).filter((c) => c !== HOME).slice(0, 6).map((c) => [HOME, c] as [string, string]);
  const subtitle = `${PERIOD_LABELS[period.preset]}${me?.resellerName ? ` · ${me.resellerName}` : tenant ? " · all resellers and direct sales" : ""}`;

  // Desktop: everything on one screen (header strip + a 4 × 2 grid of charts that fills the rest).
  if (fit) {
    return (
      <div className="flex h-[calc(100dvh-104px)] min-h-[536px] flex-col gap-3">
        <section className="glass-card relative isolate shrink-0 overflow-hidden !p-0">
          <LiveShaderBackground />
          <div className="pointer-events-none absolute -top-20 right-[-56px] h-[240px] w-[240px] opacity-70">
            <LiveGlobe mode="compact" landTone="all" arcs={arcs} initialView={[18, 70]} />
          </div>
          <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(to_right,var(--bg)_35%,transparent_85%)] opacity-85" />
          <div className="relative flex items-start justify-between gap-6 px-6 py-4">
            <div className="flex min-w-0 flex-col gap-3">
              <div>
                <h1 className="text-section font-semibold">
                  {greeting()}, {firstName}
                </h1>
                <p className="text-small text-fg-2">{subtitle}</p>
              </div>
              <div className="flex gap-x-10 [&>*]:shrink-0">{stats}</div>
            </div>
            <div className="mr-24 flex max-w-[420px] shrink-0 flex-wrap justify-end gap-2 xl:mr-40 [&_button]:h-9">{toolbar}</div>
          </div>
        </section>
        {charts ? (
          <div className="grid min-h-0 flex-1 grid-cols-4 grid-rows-2 gap-3">
            <Cell className="col-span-2" action={<Seg value={usageView} onChange={setUsageView} options={[["period", "By period"], ["monthly", "Monthly"]]} />}>
              {usageView === "period" ? charts.usage : charts.monthly}
            </Cell>
            <Cell>{charts.status}</Cell>
            <Cell>{charts.plans}</Cell>
            <Cell>{charts.top}</Cell>
            <Cell>{charts.country}</Cell>
            <Cell
              className="col-span-2"
              action={charts.revenue ? <Seg value={moneyView} onChange={setMoneyView} options={[["transactions", "Transactions"], ["revenue", "Revenue and profit"]]} /> : undefined}
            >
              {moneyView === "revenue" && charts.revenue ? charts.revenue : charts.transactions}
            </Cell>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-4 grid-rows-2 gap-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className={cn("h-full rounded-card", (i === 0 || i === 5) && "col-span-2")} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Phones, tablets and short screens: stacked and scrolling.
  return (
    <div className="flex flex-col gap-8">
      <section className="glass-card relative isolate min-h-[300px] overflow-hidden !p-0">
        <LiveShaderBackground />
        <div className="pointer-events-none absolute -right-28 -top-24 h-[280px] w-[280px] opacity-60 sm:-right-6 sm:-top-8 sm:h-[360px] sm:w-[360px] sm:opacity-90">
          <LiveGlobe mode="compact" landTone="all" arcs={arcs} initialView={[18, 70]} />
        </div>
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(to_top,var(--bg)_25%,transparent_85%)] opacity-80 sm:bg-[linear-gradient(to_right,var(--bg)_25%,transparent_72%)]" />
        <div className="relative flex min-h-[300px] flex-col justify-end gap-6 p-6 pt-28 sm:p-8 sm:pt-8">
          <div>
            <h1 className="text-title font-semibold">
              {greeting()}, {firstName}
            </h1>
            <p className="mt-1 text-body text-fg-2">{subtitle}</p>
          </div>
          <div className="grid max-w-3xl grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">{stats}</div>
        </div>
      </section>

      {toolbar}

      {!charts ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <ChartFrame key={i} title=" " loading>
              {() => null}
            </ChartFrame>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Reveal className="lg:col-span-2">{charts.usage}</Reveal>
          <Reveal>{charts.monthly}</Reveal>
          <Reveal>{charts.status}</Reveal>
          <Reveal>{charts.plans}</Reveal>
          <Reveal>{charts.transactions}</Reveal>
          <Reveal>{charts.top}</Reveal>
          <Reveal>{charts.country}</Reveal>
          {charts.revenue ? <Reveal className="lg:col-span-2">{charts.revenue}</Reveal> : null}
        </div>
      )}
    </div>
  );
}

/** A chart cell of the one-screen grid: the chart fills it; `action` adds a control to its header. */
function Cell({ children, className, action }: { children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <div className={cn("min-h-0 min-w-0", className)}>
      <ChartFill action={action}>{children}</ChartFill>
    </div>
  );
}

/** Small segmented switch for a chart panel. */
function Seg<V extends string>({ value, onChange, options }: { value: V; onChange: (v: V) => void; options: [V, string][] }) {
  return (
    <div role="radiogroup" className="inline-flex h-8 items-center gap-0.5 rounded-full border border-border p-0.5">
      {options.map(([v, l]) => (
        <button
          key={v}
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn("h-7 whitespace-nowrap rounded-full px-2.5 text-small font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary", value === v ? "bg-surface-3 text-fg" : "text-fg-2 hover:text-fg")}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
