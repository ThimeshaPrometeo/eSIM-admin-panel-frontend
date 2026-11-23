"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { LiveGlobe, LiveShaderBackground } from "@/components/platform/three/lazy";
import { SignInView } from "@/components/platform/sign-in-view";
import { demoSignInData } from "@/lib/demo/sign-in";
import { StatBlock } from "@/components/platform/primitives";
import { Input } from "@/components/ui/input";
import { NetworkBadges } from "@/components/platform/network-badges";
import coverage from "@/lib/geo/sample-coverage.json";
import { DsSection } from "./ds-kit";
import { dashboardArcs } from "./sample-data";

const SIGN_IN = demoSignInData();
const COVERED = (coverage as { countries: string[] }).countries;
const regionName = (iso: string) => {
  try {
    return new Intl.DisplayNames(["en-GB"], { type: "region" }).of(iso) ?? iso;
  } catch {
    return iso;
  }
};

/** The live graphics (spec 7.5): sign-in hero, dashboard header, coverage globe. */
export function LiveGraphicsSections() {
  return (
    <>
      <DsSection
        id="hero"
        title="Sign-in page"
        description="Staggered entrance, live pill, word-by-word headline, coverage stats, glass sign-in card, and the live globe with hub routes, comet trails, pins and event chips from the data layer. Drag the globe; move the mouse for parallax."
        flush
        stack
      >
        {() => (
          <SignInView
            embedded
            countryCount={SIGN_IN.countryCount}
            events={SIGN_IN.events}
            onSubmit={() => {
              toast("Sign-in comes in Phase 2", { description: "This is the design-system preview." });
            }}
            onPasskey={() => toast("Passkeys come with the sign-in flow")}
          />
        )}
      </DsSection>

      <DsSection
        id="dashboard-header"
        title="Dashboard header: compact globe"
        description="A smaller, quieter globe with live arcs from recent usage countries, over the shader. Numbers count up once."
        flush
      >
        {() => (
          <div className="relative min-h-[300px]">
            <LiveShaderBackground />
            <div className="absolute -right-24 -top-20 h-[260px] w-[260px] opacity-70 sm:-right-10 sm:-top-6 sm:h-[340px] sm:w-[340px] sm:opacity-90">
              <LiveGlobe mode="compact" lit={COVERED} arcs={dashboardArcs} initialView={[20, 60]} />
            </div>
            {/* keeps the numbers readable over the globe on narrow screens */}
            <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(to_top,var(--bg)_30%,transparent_85%)] sm:bg-[linear-gradient(to_right,var(--bg)_20%,transparent_70%)] opacity-80" />
            <div className="relative flex min-h-[300px] flex-col justify-end gap-6 p-6 pt-28 sm:pt-6">
              <div>
                <h3 className="text-title font-semibold">Good afternoon, Nadeesha</h3>
                <p className="mt-1 text-body text-fg-2">Usage over the last 30 days.</p>
              </div>
              <div className="grid max-w-md grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6">
                <StatBlock label="Active eSIMs" value={86} delta={0.072} />
                <StatBlock label="Data used" value={1248} format={(n) => `${Math.round(n).toLocaleString("en-GB")} GB`} />
                <StatBlock label="Revenue" value={4380} format={(n) => `€${Math.round(n).toLocaleString("en-GB")}`} delta={0.118} />
              </div>
            </div>
          </div>
        )}
      </DsSection>

      <DsSection
        id="coverage"
        title="Coverage: interactive globe"
        description="Drag to rotate, scroll or pinch to zoom, hover to highlight a country, click to select it. Selecting in the list rotates the globe to it."
        flush
      >
        {() => <CoverageDemo />}
      </DsSection>
    </>
  );
}

function CoverageDemo() {
  const [selected, setSelected] = useState<string | null>("IT");
  const [hover, setHover] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const list = useMemo(
    () =>
      COVERED.map((iso) => ({ iso, name: regionName(iso) }))
        .filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [q],
  );
  return (
    <div className="grid h-[520px] grid-cols-1 grid-rows-[auto_1fr] sm:grid-cols-[220px_1fr] sm:grid-rows-1">
      <div className="flex min-h-0 flex-col border-b border-border p-4 sm:border-b-0 sm:border-r">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-3" strokeWidth={1.5} />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search countries" className="pl-9" aria-label="Search countries" />
        </div>
        <ul className="mt-3 hidden min-h-0 flex-1 overflow-auto sm:block" role="listbox" aria-label="Countries">
          {list.map((c) => (
            <li key={c.iso}>
              <button
                role="option"
                aria-selected={selected === c.iso}
                onClick={() => setSelected(c.iso)}
                className={cn(
                  "flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-body transition-colors",
                  selected === c.iso ? "bg-surface-3 text-fg" : "text-fg-2 hover:bg-surface-3/50 hover:text-fg",
                )}
              >
                {c.name}
                <span className="font-mono text-small text-fg-3">{c.iso}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="relative min-h-0">
        <LiveGlobe
          mode="interactive"
          lit={COVERED}
          focusCountry={selected}
          selectedCountry={selected}
          onSelectCountry={setSelected}
          onHoverCountry={setHover}
        />
        <div className="glass-pop pointer-events-none absolute bottom-4 left-4 right-4 rounded-card p-4 sm:right-auto sm:w-64">
          <p className="text-small text-fg-3">{hover ? "Hovering" : "Selected"}</p>
          <p className="text-section font-semibold">{regionName((hover ?? selected) || "IT")}</p>
          <div className="mt-2 flex items-center justify-between text-small text-fg-2">
            <span>{COVERED.includes((hover ?? selected) ?? "") ? "Covered" : "Not covered"}</span>
            <NetworkBadges lte fiveG volte />
          </div>
        </div>
      </div>
    </div>
  );
}
