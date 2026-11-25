"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { countryFlag } from "@/lib/platform/coverage";
import { formatRelative } from "@/lib/platform/dates";
import type { LiveEvent } from "@/lib/platform/types";
import { cn } from "@/lib/utils";
import { LiveGlobe } from "./three/lazy";

/** The tenant's home country: arcs start here. */
const HOME = "LK";

/** Ticks every few seconds (for "updated … ago" and relative times). */
function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/**
 * The dashboard's live view: the globe with countries glowing by usage (the
 * chosen measure), arcs from home to where activity just happened, and the
 * newest events below. Drag to turn, scroll or pinch to zoom, hover a country
 * for its figure. Clicking a country focuses the whole dashboard on it (the
 * caller filters every card); the globe turns to it and a spotlight shows its
 * figures, with "Show all countries" to go back. It keeps spinning on its own
 * (`live`), and picks the spin up again after a drag unless a country is in focus.
 */
export type Spotlight = {
  iso2: string;
  name: string;
  stats: { label: string; value: string; tone?: "good" | "muted" }[];
  href: string;
};
export function LiveGlobeCard({
  values,
  format,
  nameOf,
  live,
  generatedAt,
  selected,
  onSelect,
  spotlight,
  className,
}: {
  /** Value per country for the glow (the brightest is the largest). */
  values: Record<string, number>;
  format: (v: number) => string;
  nameOf: (iso2: string) => string;
  live: LiveEvent[] | null;
  /** When the data was computed: "Updated 12 s ago". */
  generatedAt: string | null;
  /** The country in focus (the dashboard's country filter). */
  selected: string | null;
  onSelect: (iso2: string | null) => void;
  /** The focused country's figures (null while loading or with no focus). */
  spotlight?: Spotlight | null;
  className?: string;
}) {
  const now = useNow(5000);
  const [hover, setHover] = useState<string | null>(null);
  // memoised: the globe re-shades only when the figures change
  const weights = useMemo(() => {
    const max = Math.max(0, ...Object.values(values));
    return Object.fromEntries(
      Object.entries(values)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => [k, 0.3 + 0.7 * Math.sqrt(v / max)]),
    );
  }, [values]);
  // keyed by the countries, not the list: a refresh with the same places keeps the arcs (and their pulses) running
  const arcKey = [...new Set((live ?? []).map((e) => e.iso2))]
    .filter((c) => c !== HOME)
    .slice(0, 6)
    .join(",");
  const arcs = useMemo(
    () =>
      arcKey ? arcKey.split(",").map((c) => [HOME, c] as [string, string]) : [],
    [arcKey],
  );
  const ago = generatedAt
    ? Math.max(0, Math.round((now - Date.parse(generatedAt)) / 1000))
    : null;
  // three lines: the two newest events, and the newest sale if it isn't one of them (newest first)
  const feed = useMemo(() => {
    const all = live ?? [];
    const pick = all.slice(0, 2);
    const sale = all.find((e) => e.kind === "sale");
    const extra = sale && !pick.includes(sale) ? sale : all[2];
    return (extra ? [...pick, extra] : pick).sort((a, b) =>
      b.at.localeCompare(a.at),
    );
  }, [live]);
  // the small hover label: another country while one is in focus, or any country without focus
  const hoverLabel =
    hover && hover !== selected ? hover : !selected ? hover : null;

  return (
    <section
      className={cn(
        "glass-card relative flex min-h-0 min-w-0 flex-col overflow-hidden p-0",
        className,
      )}
      aria-label="Live activity"
    >
      <header className="relative z-10 flex items-center justify-between gap-2 px-3.5 pt-3">
        <h2 className="flex items-center gap-2 text-body font-semibold">
          <span className="si-live-dot !size-1.5" aria-hidden="true" />
          Live
        </h2>
        <span className="text-[11px] text-fg-3 tabular" aria-live="off">
          {ago === null
            ? "…"
            : ago < 60
              ? `Updated ${ago} s ago`
              : `Updated ${Math.floor(ago / 60)} min ago`}
        </span>
      </header>
      <div className="relative min-h-[120px] flex-1">
        <LiveGlobe
          mode="interactive"
          live
          weights={weights}
          arcs={arcs}
          selectedCountry={selected}
          focusCountry={selected}
          // only countries with usage can be focused; clicking the focused one again shows all
          onSelectCountry={(iso) =>
            iso === selected
              ? onSelect(null)
              : (values[iso] ?? 0) > 0
                ? onSelect(iso)
                : undefined
          }
          onHoverCountry={setHover}
          initialView={[30, 25]}
          spin={0.07}
        />
        {hoverLabel ? (
          <div
            className={cn(
              "glass-pop pointer-events-none absolute z-10 rounded-[10px] px-2.5 py-1 text-small",
              selected ? "bottom-6 left-3" : "left-3 top-1",
            )}
          >
            <span aria-hidden="true" className="mr-1">
              {countryFlag(hoverLabel)}
            </span>
            <span className="text-fg">{nameOf(hoverLabel)}</span>
            {(values[hoverLabel] ?? 0) > 0 ? (
              <>
                <span className="ml-2 font-semibold text-fg tabular">
                  {format(values[hoverLabel]!)}
                </span>
                <span className="ml-2 text-[11px] text-fg-3">
                  Click to focus
                </span>
              </>
            ) : (
              <span className="ml-2 text-[11px] text-fg-3">
                {selected ? "Show all to compare" : "No usage in this period"}
              </span>
            )}
          </div>
        ) : null}
        <p className="pointer-events-none absolute bottom-1 right-3 text-[10px] text-fg-3">
          {selected
            ? "Click another country to switch"
            : "Click a country to focus · drag · scroll to zoom"}
        </p>
      </div>
      {selected ? (
        // the focused country's figures replace the feed, so the globe itself stays in view
        <div
          className="relative z-10 border-t border-border/60 px-3.5 py-2"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 text-small">
            <span aria-hidden="true">{countryFlag(selected)}</span>
            <span className="min-w-0 flex-1 truncate font-semibold text-fg">
              {spotlight?.name ?? nameOf(selected)}
            </span>
            {spotlight ? (
              <Link
                href={spotlight.href}
                className="inline-flex shrink-0 items-center gap-0.5 rounded text-[11px] font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
              >
                Usage
                <ArrowRight
                  className="size-3"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-fg-2 transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-primary"
            >
              <X className="size-3" strokeWidth={2} aria-hidden="true" />
              Show all countries
            </button>
          </div>
          <dl className="mt-1 grid grid-cols-4 gap-x-2 text-[11px]">
            {(spotlight?.stats ?? []).map((st) => (
              <div key={st.label} className="min-w-0">
                <dt className="truncate text-fg-3">{st.label}</dt>
                <dd
                  className={cn(
                    "truncate font-semibold tabular",
                    st.tone === "good" ? "text-accent" : "text-fg",
                  )}
                >
                  {st.value}
                </dd>
              </div>
            ))}
            {!spotlight ? (
              <dd className="col-span-4 h-[30px] text-fg-3">Loading…</dd>
            ) : null}
          </dl>
        </div>
      ) : (
        <ul
          className="relative z-10 flex flex-col gap-0.5 border-t border-border/60 px-3.5 py-2"
          aria-label="Latest activity"
        >
          {feed.map((e) => (
            <li
              key={e.id}
              className="flex min-w-0 items-center gap-2 text-[11px] leading-4"
            >
              <span aria-hidden="true">{countryFlag(e.iso2)}</span>
              <span className="min-w-0 flex-1 truncate text-fg-2">
                <span className="text-fg">{e.country}</span> · {e.text}
              </span>
              <span className="shrink-0 text-fg-3 tabular">
                {formatRelative(e.at, new Date(now))}
              </span>
            </li>
          ))}
          {live && live.length === 0 ? (
            <li className="text-[11px] text-fg-3">No recent activity</li>
          ) : null}
        </ul>
      )}
    </section>
  );
}
