"use client";

import { useId, useState, type ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { FitPage, FitScroll } from "@/components/platform/fit-page";
import { GlassCard } from "@/components/platform/glass-card";
import { PageHeader } from "@/components/platform/primitives";
import { useAction } from "@/hooks/use-action";
import { usePermission } from "@/hooks/use-permission";
import { useResource } from "@/hooks/use-resource";
import { financeApi } from "@/lib/api/finance";
import type { TenantSettings } from "@/lib/platform/types";

type Editable = Omit<TenantSettings, "timeZone" | "currency" | "mfaRequired">;
const DOCS: { key: keyof TenantSettings["watermark"]; label: string }[] = [
  { key: "statement", label: "Monthly statements" },
  { key: "receipt", label: "Top-up receipts" },
  { key: "invoice", label: "Direct-sale invoices" },
  { key: "usage_report", label: "Usage reports" },
  { key: "price_list", label: "Price lists" },
];

/** Settings (spec 8.26): pricing, billing, stock, documents; admin edits, staff view. */
export function SettingsClient() {
  const { me } = usePermission();
  const admin = me?.role === "admin";
  const { data } = useResource(() => financeApi.getSettings(), ["settings"]);
  return (
    <FitPage>
      <PageHeader title="Settings" description={admin ? "How prices, holds, alerts and documents work for everyone." : "How prices, holds, alerts and documents work. Only an administrator can change them."} />
      <FitScroll>{!data ? <Skeleton className="h-96" /> : <SettingsForm initial={data} readOnly={!admin} />}</FitScroll>
    </FitPage>
  );
}

function SettingsForm({ initial, readOnly }: { initial: TenantSettings; readOnly: boolean }) {
  const [v, setV] = useState<Editable>(() => ({ ...initial, watermark: { ...initial.watermark } }));
  const { run, pending } = useAction();
  const dirty = JSON.stringify(pick(v)) !== JSON.stringify(pick(initial));
  const num = (k: keyof Editable) => (x: string) => setV((s) => ({ ...s, [k]: x === "" ? 0 : Number(x) }));

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Pricing" description="Reseller price per MB = Yesim €/MB × (1 + markup) × (1 − discount).">
          <NumberField label="Default markup for new resellers" suffix="%" value={v.defaultMarkupPercent} onChange={num("defaultMarkupPercent")} readOnly={readOnly} hint="Each reseller's own markup is set on their page." />
          <NumberField label="Retail markup for direct sales" suffix="%" value={v.retailMarkupPercent} onChange={num("retailMarkupPercent")} readOnly={readOnly} hint="The price direct customers pay over Yesim cost." />
          <NumberField label="Price spread warning" suffix="×" value={v.spreadWarningRatio} onChange={num("spreadWarningRatio")} readOnly={readOnly} hint="Warn on a plan when its dearest network costs this many times its cheapest." />
        </Section>
        <Section title="Billing" description="Holds, waiting plans and wallet warnings.">
          <NumberField label="Cancel unfunded plans after" suffix="days" value={v.waitingPlanCancelDays} onChange={num("waitingPlanCancelDays")} readOnly={readOnly} />
          <NumberField label="Low wallet warning below" prefix="€" value={v.lowWalletThreshold} onChange={num("lowWalletThreshold")} readOnly={readOnly} />
          <NumberField label="House wallet warning below" prefix="€" value={v.houseWalletLowThreshold} onChange={num("houseWalletLowThreshold")} readOnly={readOnly} />
        </Section>
        <Section title="Stock" description="Free eSIMs in the supplier pool.">
          <NumberField label="Low stock warning below" suffix="eSIMs" value={v.lowStockThreshold} onChange={num("lowStockThreshold")} readOnly={readOnly} />
        </Section>
        <Section title="Company" description="Fixed for this workspace.">
          <ReadOnly label="Currency" value="EUR" />
          <ReadOnly label="Time zone" value={initial.timeZone} hint="Dates everywhere are shown in this time zone." />
        </Section>
        <Section title="Documents" description="Every PDF carries “Downloaded by <name> (<username>) · <date and time>” unless switched off here. Downloads are always recorded in the audit log.">
          <div className="flex flex-col divide-y divide-border">
            {DOCS.map((d) => (
              <label key={d.key} className="flex items-center justify-between py-2.5 text-body">
                {d.label}
                <Switch
                  checked={v.watermark[d.key]}
                  disabled={readOnly}
                  onCheckedChange={(on) => setV((s) => ({ ...s, watermark: { ...s.watermark, [d.key]: on } }))}
                  aria-label={`Watermark on ${d.label.toLowerCase()}`}
                />
              </label>
            ))}
          </div>
          <TextField label="Tax wording on documents" value={v.taxWording} onChange={(x) => setV((s) => ({ ...s, taxWording: x }))} readOnly={readOnly} />
        </Section>
        <Section title="Security" description="Applies to every account.">
          <p className="flex items-start gap-2 text-body">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={1.5} />
            Two-factor authentication is required for all accounts (authenticator app or a passkey). After 10 failed sign-ins an account locks for 15 minutes.
          </p>
        </Section>
      </div>
      {!readOnly ? (
        <div className="glass-bar sticky bottom-0 -mx-1 flex items-center justify-end gap-2 rounded-card border border-border px-4 py-3">
          <span className="mr-auto text-small text-fg-3">{dirty ? "Unsaved changes" : "All changes saved"}</span>
          <Button variant="ghost" disabled={!dirty || pending} onClick={() => setV({ ...initial, watermark: { ...initial.watermark } })}>
            Discard
          </Button>
          <Button disabled={!dirty || pending} onClick={() => run(() => financeApi.updateSettings(pick(v)), { success: "Settings saved" })}>
            Save settings
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function pick(s: Editable | TenantSettings): Editable {
  return {
    defaultMarkupPercent: s.defaultMarkupPercent,
    retailMarkupPercent: s.retailMarkupPercent,
    spreadWarningRatio: s.spreadWarningRatio,
    waitingPlanCancelDays: s.waitingPlanCancelDays,
    houseWalletLowThreshold: s.houseWalletLowThreshold,
    lowWalletThreshold: s.lowWalletThreshold,
    lowStockThreshold: s.lowStockThreshold,
    watermark: { ...s.watermark },
    taxWording: s.taxWording,
  };
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <GlassCard className="flex flex-col gap-4">
      <div>
        <h2 className="text-section font-semibold">{title}</h2>
        <p className="text-small text-fg-2">{description}</p>
      </div>
      {children}
    </GlassCard>
  );
}

function NumberField({ label, value, onChange, readOnly, hint, prefix, suffix }: { label: string; value: number; onChange: (v: string) => void; readOnly: boolean; hint?: string; prefix?: string; suffix?: string }) {
  const id = useId();
  return (
    <div className="grid items-center gap-2 sm:grid-cols-[1fr_180px]">
      <label htmlFor={id} className="text-body">
        {label}
        {hint ? <span className="block text-small text-fg-3">{hint}</span> : null}
      </label>
      <span className="relative">
        {prefix ? <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-3">{prefix}</span> : null}
        <Input id={id} inputMode="decimal" value={String(value)} readOnly={readOnly} onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))} className={`${prefix ? "pl-7" : ""} ${suffix ? "pr-14" : ""} text-right tabular`} />
        {suffix ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-small text-fg-3">{suffix}</span> : null}
      </span>
    </div>
  );
}

function TextField({ label, value, onChange, readOnly }: { label: string; value: string; onChange: (v: string) => void; readOnly: boolean }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-small font-medium text-fg-2">
        {label}
      </label>
      <Textarea id={id} value={value} readOnly={readOnly} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function ReadOnly({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-body">
      <span>
        {label}
        {hint ? <span className="block text-small text-fg-3">{hint}</span> : null}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
