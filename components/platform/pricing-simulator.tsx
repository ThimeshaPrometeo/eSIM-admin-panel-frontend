"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useResource } from "@/hooks/use-resource";
import { catalogueApi } from "@/lib/api/catalogue";
import { financeApi } from "@/lib/api/finance";
import { peopleApi } from "@/lib/api/people";
import { countryFlag } from "@/lib/platform/coverage";
import { formatPerMb } from "@/lib/platform/money";
import type { SimulationLine } from "@/lib/platform/types";
import { BYTES } from "@/lib/platform/units";
import { cn } from "@/lib/utils";
import { GlassCard } from "./glass-card";

const eur = (n: number) => `€${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${n.toLocaleString("en-GB", { maximumFractionDigits: 1 })}%`;

/**
 * Pricing simulator (spec 8.32, admin): a reseller (or a direct sale), a
 * country or one network, and an amount of data. Shows the Yesim cost, the
 * reseller price, the discount's effect, profit and margin, with the formula
 * written out in plain numbers.
 */
export function PricingSimulator({ resellerId: fixed, className }: { resellerId?: string; className?: string }) {
  const resellers = useResource(() => peopleApi.listResellerOptions(), ["reseller-options"]);
  const countries = useResource(() => catalogueApi.listCoverageCountries({}), ["sim-countries"]);
  const [resellerId, setResellerId] = useState<string>(fixed ?? "r1");
  const [iso2, setIso2] = useState("IT");
  const [networkId, setNetworkId] = useState<string>("all");
  const [amount, setAmount] = useState("1");
  const [unit, setUnit] = useState<"MB" | "GB">("GB");
  const bytes = Math.max(0, Math.round((Number(amount) || 0) * BYTES[unit]));
  const reseller = fixed ?? resellerId;
  const { data } = useResource(() => financeApi.simulate({ resellerId: reseller, iso2, networkId: networkId === "all" ? null : networkId, bytes }), [reseller, iso2, networkId, bytes], bytes > 0);
  const country = useResource(() => catalogueApi.getCoverageCountry(iso2), [iso2]);
  const [picked, setPicked] = useState<string | null>(null);
  const focus: SimulationLine | undefined = useMemo(() => data?.lines.find((l) => l.networkId === picked) ?? data?.lines[Math.floor((data.lines.length - 1) / 2)], [data, picked]);

  return (
    <div className={cn("grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]", className)}>
      <GlassCard className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {!fixed ? (
            <label className="flex flex-col gap-1.5 text-small font-medium text-fg-2">
              Reseller
              <Select value={resellerId} onValueChange={setResellerId}>
                <SelectTrigger aria-label="Reseller">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(resellers.data ?? []).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="direct">Direct sale (retail price)</SelectItem>
                </SelectContent>
              </Select>
            </label>
          ) : null}
          <label className="flex flex-col gap-1.5 text-small font-medium text-fg-2">
            Country
            <Select
              value={iso2}
              onValueChange={(v) => {
                setIso2(v);
                setNetworkId("all");
                setPicked(null);
              }}
            >
              <SelectTrigger aria-label="Country">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(countries.data ?? [])
                  .filter((c) => c.pricedCount > 0)
                  .map((c) => (
                    <SelectItem key={c.iso2} value={c.iso2}>
                      {countryFlag(c.iso2)} {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1.5 text-small font-medium text-fg-2">
            Network
            <Select
              value={networkId}
              onValueChange={(v) => {
                setNetworkId(v);
                setPicked(v === "all" ? null : v);
              }}
            >
              <SelectTrigger aria-label="Network">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All networks</SelectItem>
                {(country.data?.networks ?? [])
                  .filter((n) => n.pricePerMb !== null)
                  .map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.operator}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1.5 text-small font-medium text-fg-2">
            Data
            <span className="flex gap-2">
              <Input aria-label="Data amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
              <Select value={unit} onValueChange={(u) => setUnit(u as "MB" | "GB")}>
                <SelectTrigger className="w-24 shrink-0" aria-label="Unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MB">MB</SelectItem>
                  <SelectItem value="GB">GB</SelectItem>
                </SelectContent>
              </Select>
            </span>
          </label>
        </div>
        {!data ? (
          <Skeleton className="h-40" />
        ) : (
          <div className="overflow-hidden rounded-control border border-border">
            <table className="w-full text-body">
              <thead>
                <tr className="border-b border-border text-left text-small text-fg-2">
                  <th className="px-3 py-2 font-medium">Network</th>
                  <th className="px-3 py-2 text-right font-medium">Yesim cost</th>
                  <th className="px-3 py-2 text-right font-medium">{data.direct ? "Retail price" : "Reseller price"}</th>
                  <th className="px-3 py-2 text-right font-medium">Profit</th>
                  <th className="px-3 py-2 text-right font-medium">Margin</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((l) => (
                  <tr
                    key={l.networkId}
                    onClick={() => setPicked(l.networkId)}
                    className={cn("cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-surface-3/50", focus?.networkId === l.networkId && "bg-surface-3")}
                  >
                    <td className="px-3 py-2">{l.operator}</td>
                    <td className="px-3 py-2 text-right tabular">{eur(l.cost)}</td>
                    <td className="px-3 py-2 text-right font-medium tabular">{eur(l.price)}</td>
                    <td className="px-3 py-2 text-right tabular text-accent">{eur(l.profit)}</td>
                    <td className="px-3 py-2 text-right tabular">{pct(l.marginPercent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <GlassCard className="flex flex-col gap-4">
        <div>
          <h3 className="text-section font-semibold">The formula, in plain numbers</h3>
          <p className="text-small text-fg-2">
            {data?.buyer ?? ""}
            {focus ? ` · ${focus.operator} (${focus.country})` : ""}
          </p>
        </div>
        {!focus ? (
          <p className="text-body text-fg-3">Enter an amount of data.</p>
        ) : (
          <ol className="flex flex-col gap-3 text-body">
            <Step n={1} label="Yesim cost">
              {focus.mb.toLocaleString("en-GB", { maximumFractionDigits: 1 })} MB × {formatPerMb(focus.costPerMb)} per MB = <b className="tabular">{eur(focus.cost)}</b>
            </Step>
            <Step n={2} label={data?.direct ? `Retail markup ${focus.markupPercent}%` : `Markup ${focus.markupPercent}%`}>
              {eur(focus.cost)} × {(1 + focus.markupPercent / 100).toLocaleString("en-GB", { maximumFractionDigits: 4 })} = <b className="tabular">{eur(focus.beforeDiscount)}</b>
              <span className="text-fg-3"> (+{eur(focus.beforeDiscount - focus.cost)})</span>
            </Step>
            <Step n={3} label={focus.discountPercent ? `Discount ${focus.discountPercent}%` : "No discount"}>
              {focus.discountPercent ? (
                <>
                  {eur(focus.beforeDiscount)} × {(1 - focus.discountPercent / 100).toLocaleString("en-GB", { maximumFractionDigits: 4 })} = <b className="tabular">{eur(focus.price)}</b>
                  <span className="text-fg-3"> (−{eur(focus.discountAmount)})</span>
                </>
              ) : (
                <>
                  Price stays <b className="tabular">{eur(focus.price)}</b>
                </>
              )}
            </Step>
            <Step n={4} label={data?.direct ? "Customer pays" : "Reseller pays"} highlight>
              <b className="text-section tabular">{eur(focus.price)}</b>
              <span className="text-fg-3"> · {formatPerMb(focus.price / Math.max(focus.mb, 1e-9))} per MB</span>
            </Step>
            <Step n={5} label="Our profit">
              {eur(focus.price)} − {eur(focus.cost)} = <b className="tabular text-accent">{eur(focus.profit)}</b>
              <span className="text-fg-3"> · margin {pct(focus.marginPercent)} of the price</span>
            </Step>
          </ol>
        )}
        <p className="mt-auto text-small text-fg-3">
          Price per MB = Yesim €/MB × (1 + markup) × (1 − discount). The same formula prices the price list, rates every usage charge and builds the statements and the profit
          report. A plan-specific discount, where one exists, replaces the reseller-wide discount used here.
        </p>
      </GlassCard>
    </div>
  );
}

function Step({ n, label, children, highlight }: { n: number; label: string; children: React.ReactNode; highlight?: boolean }) {
  return (
    <li className={cn("flex gap-3 rounded-control border px-3 py-2.5", highlight ? "border-[color-mix(in_oklab,var(--primary)_45%,transparent)] bg-[color-mix(in_oklab,var(--primary)_8%,transparent)]" : "border-border")}>
      <span className="grid size-6 shrink-0 place-items-center rounded-full border border-border-strong text-small tabular">{n}</span>
      <span className="flex min-w-0 flex-col">
        <span className="text-small text-fg-3">{label}</span>
        <span>{children}</span>
      </span>
    </li>
  );
}
