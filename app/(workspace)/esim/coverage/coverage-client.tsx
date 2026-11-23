"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DemoZoneChip, FilterSelect, SearchInput } from "@/components/platform/fields";
import { GlassCard } from "@/components/platform/glass-card";
import { NetworkBadges } from "@/components/platform/network-badges";
import { EmptyState } from "@/components/platform/primitives";
import { LiveGlobe } from "@/components/platform/three/lazy";
import { usePermission } from "@/hooks/use-permission";
import { useResource } from "@/hooks/use-resource";
import { useMediaQuery, FIT_QUERY } from "@/hooks/use-media-query";
import { catalogueApi } from "@/lib/api/catalogue";
import { countryFlag } from "@/lib/platform/coverage";
import { formatPerGb } from "@/lib/platform/money";
import { formatPlanData } from "@/lib/platform/units";
import { cn } from "@/lib/utils";

/** Coverage (spec 8.12): interactive globe ↔ filterable country list, networks and prices for the selected country. */
export function CoverageClient() {
  const { can, isTenant } = usePermission();
  const fit = useMediaQuery(FIT_QUERY);
  const [q, setQ] = useState("");
  const [tech, setTech] = useState<"4g" | "5g" | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [picked, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const countries = useResource(() => catalogueApi.listCoverageCountries({ q, tech, planId, zoneId }), [q, tech, planId, zoneId]);
  const plans = useResource(() => catalogueApi.listPlansCatalogue(), ["coverage-plans"], can("sell_esim") || can("plans") || can("reseller_plans"));
  const zones = useResource(() => catalogueApi.listZones(), ["zones"]);
  const list = useMemo(() => countries.data ?? [], [countries.data]);
  const lit = useMemo(() => list.filter((c) => c.pricedCount > 0).map((c) => c.iso2), [list]);
  // desktop starts on Italy (or the first country); phones show the list first
  const selected = picked ?? (fit && list.length ? (list.find((c) => c.iso2 === "IT")?.iso2 ?? list[0]!.iso2) : null);
  const detail = useResource(() => catalogueApi.getCoverageCountry(selected!), [selected], !!selected);

  const filters = (
    <div className="flex flex-col gap-2">
      <SearchInput value={q} onChange={setQ} placeholder="Search countries" className="sm:w-full" />
      <div className="grid grid-cols-2 gap-2">
        <FilterSelect label="Network type" value={tech} onChange={setTech} all="Any network" options={[{ value: "4g", label: "4G" }, { value: "5g", label: "5G" }]} className="sm:w-full" />
        <FilterSelect label="Zone" value={zoneId} onChange={setZoneId} all="Any zone" options={(zones.data ?? []).map((z) => ({ value: z.id, label: z.demoZone ? `${z.name} (demo)` : z.name }))} className="sm:w-full" />
      </div>
      {plans.data ? (
        <FilterSelect
          label="Plan"
          value={planId}
          onChange={setPlanId}
          all="Any plan"
          options={plans.data.filter((p) => !p.resellerPlanId).map((p) => ({ value: p.planId, label: p.name }))}
          className="sm:w-full"
        />
      ) : null}
    </div>
  );

  const countryList = (
    <div className="min-h-0 flex-1 overflow-y-auto" role="listbox" aria-label="Countries">
      {countries.loading && !countries.data ? (
        <div className="flex flex-col gap-2 p-1">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState illustration="globe" title="No countries match" description="Try another search or filter." />
      ) : (
        list.map((c) => (
          <button
            key={c.iso2}
            role="option"
            aria-selected={selected === c.iso2}
            onClick={() => setSelected(c.iso2)}
            onMouseEnter={() => setHover(c.iso2)}
            onMouseLeave={() => setHover(null)}
            className={cn(
              "flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left transition-colors duration-[180ms] focus-visible:outline-2 focus-visible:outline-primary",
              selected === c.iso2 ? "bg-surface-3 shadow-[inset_0_1px_0_var(--highlight),0_0_0_1px_var(--border)]" : "hover:bg-surface-3/50",
            )}
          >
            <span className="text-[18px] leading-none">{countryFlag(c.iso2)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body font-medium">{c.name}</span>
              <span className="block text-small text-fg-3">
                {c.pricedCount} of {c.networkCount} network{c.networkCount > 1 ? "s" : ""}
                {c.fromPerMb !== null ? ` · from ${formatPerGb(c.fromPerMb)}/GB` : " · unavailable"}
              </span>
            </span>
            {c.nr ? <span className="rounded-full border border-[color-mix(in_oklab,var(--accent)_40%,transparent)] px-1.5 text-[11px] font-medium text-fg">5G</span> : null}
          </button>
        ))
      )}
    </div>
  );

  const panel = selected ? (
    <CountryPanel detail={detail.data} loading={detail.loading} canSell={can("sell_esim", "manage")} priceLabel={isTenant ? "Supplier cost" : "Your price"} onBack={fit ? undefined : () => setSelected(null)} />
  ) : null;

  if (!fit) {
    // phones and tablets: list, then a detail screen
    return (
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-title font-semibold">Coverage</h1>
          <p className="mt-1 text-body text-fg-2">{list.length} countries · prices per GB</p>
        </header>
        {selected ? (
          panel
        ) : (
          <>
            <GlassCard className="relative h-64 overflow-hidden !p-0">
              <LiveGlobe mode="interactive" lit={lit} selectedCountry={selected} onSelectCountry={setSelected} initialView={[25, 40]} />
            </GlassCard>
            {filters}
            <GlassCard className="!p-2">{countryList}</GlassCard>
          </>
        )}
      </div>
    );
  }

  // desktop: one screen — list | globe | country
  return (
    <div className="grid h-[calc(100dvh-104px)] min-h-[560px] grid-cols-[300px_1fr_360px] gap-3">
      <GlassCard className="flex min-h-0 flex-col gap-3 !p-3">
        <div className="px-1 pt-1">
          <h1 className="text-section font-semibold">Coverage</h1>
          <p className="text-small text-fg-2">
            {list.length} countries · {isTenant ? "supplier cost" : "your prices"} per GB
          </p>
        </div>
        {filters}
        {countryList}
      </GlassCard>
      <GlassCard className="relative min-h-0 overflow-hidden !p-0">
        <LiveGlobe mode="interactive" lit={lit} focusCountry={selected} selectedCountry={selected} onSelectCountry={setSelected} onHoverCountry={setHover} initialView={[30, 15]} />
        <p className="pointer-events-none absolute bottom-4 left-4 text-small text-fg-3">Drag to rotate · scroll to zoom · click a country</p>
        {hover && hover !== selected ? (
          <div className="glass-pop pointer-events-none absolute left-4 top-4 rounded-control px-3 py-2 text-body">
            {countryFlag(hover)} {list.find((c) => c.iso2 === hover)?.name ?? hover}
            <span className="ml-2 text-small text-fg-3">{lit.includes(hover) ? "Covered" : "Not covered"}</span>
          </div>
        ) : null}
      </GlassCard>
      <div className="min-h-0">{panel}</div>
    </div>
  );
}

function CountryPanel({
  detail,
  loading,
  priceLabel,
  canSell,
  onBack,
}: {
  detail: Awaited<ReturnType<typeof catalogueApi.getCoverageCountry>> | undefined;
  loading: boolean;
  priceLabel: string;
  canSell: boolean;
  onBack?: () => void;
}) {
  return (
    <GlassCard className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto">
      {onBack ? (
        <Button variant="ghost" size="sm" className="-ml-2 self-start" onClick={onBack}>
          <ArrowLeft strokeWidth={1.5} />
          All countries
        </Button>
      ) : null}
      {!detail ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-24" />
        </div>
      ) : (
        <>
          <div className={cn("transition-opacity", loading && "opacity-60")}>
            <p className="text-[32px] leading-none">{countryFlag(detail.iso2)}</p>
            <h2 className="mt-2 text-title font-semibold">{detail.name}</h2>
            <p className="text-small text-fg-3">
              {detail.networks.length} network{detail.networks.length > 1 ? "s" : ""} · {priceLabel} per GB
            </p>
          </div>
          <section>
            <h3 className="mb-2 text-small font-medium text-fg-2">Networks</h3>
            <ul className="flex flex-col divide-y divide-border rounded-control border border-border">
              {detail.networks.map((n) => (
                <li key={n.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-body">{n.operator}</p>
                    <NetworkBadges lte={n.lte} fiveG={n.nr} volte={n.volte} className="mt-1" />
                  </div>
                  <span className={cn("shrink-0 text-body tabular", n.pricePerMb === null ? "text-fg-3" : "font-medium")}>
                    {n.pricePerMb === null ? "Unavailable" : formatPerGb(n.pricePerMb)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="mb-2 text-small font-medium text-fg-2">Plans that work here</h3>
            {detail.plans.length ? (
              <ul className="flex flex-col gap-1.5">
                {detail.plans.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-body">
                    <span>{p.name}</span>
                    <span className="text-small text-fg-3">
                      {formatPlanData(p.dataBytes)} · {p.validityDays} days
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body text-fg-3">No plan covers this country yet.</p>
            )}
            {detail.plans.length && canSell ? (
              <Button asChild variant="link" className="mt-2 px-0">
                <Link href={`/esim/sell?country=${detail.iso2}`}>
                  Sell a plan for {detail.name}
                  <ArrowRight strokeWidth={1.5} />
                </Link>
              </Button>
            ) : null}
          </section>
          <section>
            <h3 className="mb-2 text-small font-medium text-fg-2">Zones that include it</h3>
            <ul className="flex flex-wrap gap-2">
              {detail.zones.map((z) => (
                <li key={z.id} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-small">
                  {z.name}
                  {z.demoZone ? <DemoZoneChip /> : null}
                  {!z.usable ? <span className="text-fg-3">· not usable for plans</span> : null}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </GlassCard>
  );
}
