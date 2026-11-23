"use client";

import { FitPage, FitScroll } from "@/components/platform/fit-page";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId, useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { AlertTriangle, ArrowLeft, ArrowRight, Calendar, Check, CircleSlash, Clock, Download, Mail, Search, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmailQrDialog } from "@/components/platform/esim-dialogs";
import { EsimCard } from "@/components/platform/esim-card";
import { CopyButton, PriceRangeText } from "@/components/platform/fields";
import { GlassCard } from "@/components/platform/glass-card";
import { EmptyState, PageHeader } from "@/components/platform/primitives";
import { usePlatform } from "@/contexts/platform-context";
import { usePermission } from "@/hooks/use-permission";
import { useResource } from "@/hooks/use-resource";
import { catalogueApi } from "@/lib/api/catalogue";
import { errorMessage, ApiError } from "@/lib/api/errors";
import { esimsApi, type SimulatedOutcome } from "@/lib/api/esims";
import { operationsApi } from "@/lib/api/operations";
import { peopleApi } from "@/lib/api/people";
import { countryFlag } from "@/lib/platform/coverage";
import { formatDateTime } from "@/lib/platform/dates";
import { formatMoney, toNumber } from "@/lib/platform/money";
import type { ActivationInput, CatalogueItem, Customer, SellResult } from "@/lib/platform/types";
import { formatPlanData } from "@/lib/platform/units";
import { cn } from "@/lib/utils";

const STEPS = ["Plan", "Customer", "Activation", "Confirm"] as const;

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Sell eSIM / Add plan (spec 8.5): one stepper for both; `?esim=<id>` adds a plan to that eSIM. */
export function SellClient() {
  const params = useSearchParams();
  const esimId = params.get("esim");
  const country = params.get("country");
  const { isDemo } = usePlatform();
  const { isTenant } = usePermission();
  const esim = useResource(() => esimsApi.getEsim(esimId!), [esimId], !!esimId);
  const addPlan = !!esimId;

  const [step, setStep] = useState(0);
  const [plan, setPlan] = useState<CatalogueItem | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  // `?customer=<id>` (from a customer's page) starts with that customer chosen
  const presetId = params.get("customer");
  const preset = useResource(() => operationsApi.getCustomer(presetId!), [presetId], !!presetId);
  const [presetApplied, setPresetApplied] = useState(false);
  if (!presetApplied && preset.data) {
    setPresetApplied(true);
    setCustomer(preset.data);
  }
  const [activation, setActivation] = useState<ActivationInput>({ mode: "first_use" });
  const [retail, setRetail] = useState("");
  const [simulate, setSimulate] = useState<SimulatedOutcome>("normal");
  const [result, setResult] = useState<SellResult | null>(null);
  const [sending, setSending] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  // one idempotency key per attempt; a retry of the same attempt reuses it
  const [firstKey] = useState(newKey);
  const key = useRef<string>(firstKey);

  const steps = addPlan ? STEPS.filter((s) => s !== "Customer") : STEPS;
  const at = steps[step]!;
  const go = (n: number) => {
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    if (!plan) return;
    setSending(true);
    setRefusal(null);
    const input = { planId: plan.planId, resellerPlanId: plan.resellerPlanId, customerId: customer?.id ?? null, activation, retailAmount: retail ? retail : null };
    try {
      const r = addPlan ? await esimsApi.addPlanToEsim(esimId!, input, key.current, simulate) : await esimsApi.createEsimOrder(input, key.current, simulate);
      setResult(r);
      key.current = newKey();
    } catch (e) {
      setRefusal(errorMessage(e));
      if (e instanceof ApiError && e.status >= 500) toast.error(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  if (result) return <SellResultView result={result} addPlan={addPlan} esimId={esimId} onAgain={() => { setResult(null); setPlan(null); setCustomer(null); setActivation({ mode: "first_use" }); setRetail(""); setSimulate("normal"); go(0); }} />;

  return (
    <FitPage>
      <PageHeader
        title={addPlan ? "Add plan" : "Sell eSIM"}
        description={
          addPlan
            ? esim.data
              ? `Adding a plan to eSIM ${esim.data.iccid}${esim.data.customerName ? ` (${esim.data.customerName})` : ""}.`
              : "Adding a plan to an eSIM."
            : isTenant
              ? "A direct sale: charged to the house wallet at supplier cost."
              : "Pick a plan; your wallet reserves its hold and usage is charged per MB."
        }
      />
      <Stepper steps={steps as unknown as string[]} current={step} onJump={(i) => i < step && go(i)} />

<FitScroll>
      {at === "Plan" ? (
        <PlanStep
          country={country}
          selected={plan}
          onPick={(p) => {
            setPlan(p);
            go(step + 1);
          }}
        />
      ) : at === "Customer" ? (
        <CustomerStep value={customer} onChange={setCustomer} onBack={() => go(step - 1)} onNext={() => go(step + 1)} />
      ) : at === "Activation" ? (
        <ActivationStep value={activation} onChange={setActivation} onBack={() => go(step - 1)} onNext={() => go(step + 1)} />
      ) : plan ? (
        <ConfirmStep
          plan={plan}
          customer={customer}
          activation={activation}
          setActivation={setActivation}
          addPlan={addPlan}
          retail={retail}
          setRetail={setRetail}
          demo={isDemo}
          simulate={simulate}
          setSimulate={setSimulate}
          sending={sending}
          refusal={refusal}
          onBack={() => go(step - 1)}
          onSubmit={submit}
        />
      ) : null}
      </FitScroll>
    </FitPage>
  );
}

function Stepper({ steps, current, onJump }: { steps: string[]; current: number; onJump: (i: number) => void }) {
  return (
    <ol className="glass-card relative flex items-center gap-2 overflow-x-auto !rounded-full p-1.5" aria-label="Steps">
      {steps.map((s, i) => (
        <li key={s} className="flex flex-1 items-center">
          <button
            onClick={() => onJump(i)}
            disabled={i >= current}
            aria-current={i === current ? "step" : undefined}
            className={cn(
              "flex h-9 w-full items-center justify-center gap-2 whitespace-nowrap rounded-full px-3 text-small font-medium transition-colors duration-500",
              i === current ? "bg-surface-3 text-fg shadow-[inset_0_1px_0_var(--highlight),0_0_0_1px_var(--border-strong)]" : i < current ? "text-fg-2 hover:text-fg" : "text-fg-3",
            )}
          >
            <span className={cn("grid size-5 place-items-center rounded-full text-[11px] tabular", i < current ? "bg-accent text-[#04110c]" : i === current ? "bg-primary-solid text-on-solid" : "border border-border-strong")}>
              {i < current ? <Check className="size-3" strokeWidth={2.5} /> : i + 1}
            </span>
            {s}
          </button>
        </li>
      ))}
    </ol>
  );
}

function PlanStep({ country, selected, onPick }: { country: string | null; selected: CatalogueItem | null; onPick: (p: CatalogueItem) => void }) {
  const [q, setQ] = useState("");
  const [iso, setIso] = useState<string | null>(country);
  const { data, loading } = useResource(() => catalogueApi.listPlansCatalogue({ q, country: iso }), [q, iso]);
  const countries = useResource(() => catalogueApi.listCoverageCountries({}), ["sell-countries"]);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-3" strokeWidth={1.5} />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a plan or a country" aria-label="Search plans" className="pl-9" />
        </div>
        <Select value={iso ?? "all"} onValueChange={(v) => setIso(v === "all" ? null : v)}>
          <SelectTrigger className="w-full sm:w-64" aria-label="Country">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any country</SelectItem>
            {(countries.data ?? [])
              .filter((c) => c.planCount > 0)
              .map((c) => (
                <SelectItem key={c.iso2} value={c.iso2}>
                  {countryFlag(c.iso2)} {c.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
      {loading && !data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-56 rounded-card" />
          ))}
        </div>
      ) : !data?.length ? (
        <GlassCard>
          <EmptyState illustration="globe" title="No plans match" description="Try another country or search." />
        </GlassCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((p) => (
            <PlanCard key={`${p.planId}-${p.resellerPlanId ?? ""}`} plan={p} selected={selected?.planId === p.planId && selected?.resellerPlanId === p.resellerPlanId} onPick={() => onPick(p)} />
          ))}
        </div>
      )}
    </div>
  );
}

function PlanCard({ plan, selected, onPick }: { plan: CatalogueItem; selected: boolean; onPick: () => void }) {
  const [open, setOpen] = useState(false);
  const flags = plan.countries.slice(0, 8);
  return (
    <GlassCard interactive className={cn("flex flex-col gap-4", selected && "ring-2 ring-primary")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {plan.resellerPlanId ? <p className="mb-1 inline-flex items-center gap-1 text-small font-medium text-accent"><Sparkles className="size-3.5" strokeWidth={1.5} />Your plan</p> : null}
          <h3 className="truncate text-section font-semibold">{plan.name}</h3>
          <p className="text-small text-fg-3">{plan.resellerPlanId ? `${plan.basePlanName} · ` : ""}{plan.zoneName}</p>
        </div>
        <div className="text-right">
          <p className="text-section font-semibold tabular">{formatPlanData(plan.dataBytes)}</p>
          <p className="text-small text-fg-3">{plan.validityDays} days</p>
        </div>
      </div>
      <div>
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-small text-fg-2 hover:text-fg" aria-expanded={open}>
          <span className="flex -space-x-1">{flags.map((c) => <span key={c} className="text-[15px]">{countryFlag(c)}</span>)}</span>
          Works in {plan.countries.length} {plan.countries.length === 1 ? "country" : "countries"}
        </button>
        {open ? <p className="mt-2 max-h-28 overflow-y-auto text-small leading-6 text-fg-2">{plan.countries.map((c) => countryFlag(c)).join(" ")}</p> : null}
      </div>
      <div className="rounded-control border border-border px-3 py-2.5 text-small">
        <p className="text-fg-3">Price per GB</p>
        <PriceRangeText perGb={plan.perGb} className="text-body" />
        <p className="mt-1 text-fg-3">
          Hold <span className="font-medium text-fg tabular">{formatMoney(plan.hold)}</span>
          {plan.sellingPrice ? <span> · you charge {formatMoney(plan.sellingPrice)}</span> : null}
        </p>
      </div>
      <Button className="mt-auto" variant={selected ? "primary" : "secondary"} onClick={onPick} arrow>
        Choose plan
      </Button>
    </GlassCard>
  );
}

function CustomerStep({ value, onChange, onBack, onNext }: { value: Customer | null; onChange: (c: Customer | null) => void; onBack: () => void; onNext: () => void }) {
  const id = useId();
  const [q, setQ] = useState("");
  const { data } = useResource(() => peopleApi.listCustomers({ q }), [q]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <GlassCard className="flex flex-col gap-5">
      <div>
        <h2 className="text-section font-semibold">Customer (optional)</h2>
        <p className="text-body text-fg-2">Link the eSIM to a customer to find it later and email them the QR code.</p>
      </div>
      {!creating ? (
        <>
          <div className="relative sm:w-96">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-3" strokeWidth={1.5} />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customers" aria-label="Search customers" className="pl-9" />
          </div>
          <ul className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3" role="listbox" aria-label="Customers">
            {(data ?? []).slice(0, 24).map((c) => (
              <li key={c.id}>
                <button
                  role="option"
                  aria-selected={value?.id === c.id}
                  onClick={() => onChange(value?.id === c.id ? null : c)}
                  className={cn("flex w-full flex-col rounded-control border px-3 py-2 text-left transition-colors", value?.id === c.id ? "border-primary bg-surface-3" : "border-border hover:bg-surface-3/50")}
                >
                  <span className="text-body font-medium">{c.name}</span>
                  <span className="truncate text-small text-fg-3">{c.email}</span>
                </button>
              </li>
            ))}
          </ul>
          <Button variant="link" className="self-start px-0" onClick={() => setCreating(true)}>
            Add a new customer
          </Button>
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id={`${id}-n`} label="Name">
            <Input id={`${id}-n`} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field id={`${id}-e`} label="Email">
            <Input id={`${id}-e`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field id={`${id}-p`} label="Phone">
            <Input id={`${id}-p`} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <div className="flex gap-2 sm:col-span-3">
            <Button
              disabled={name.trim().length < 2 || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const c = await peopleApi.createCustomer({ name, email, phone });
                  onChange(c);
                  setCreating(false);
                  toast.success("Customer added");
                } catch (e) {
                  toast.error(errorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Add customer
            </Button>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      <StepNav onBack={onBack} onNext={onNext} nextLabel={value ? `Continue with ${value.name}` : "Continue without a customer"} />
    </GlassCard>
  );
}

function ActivationStep({ value, onChange, onBack, onNext }: { value: ActivationInput; onChange: (a: ActivationInput) => void; onBack: () => void; onNext: () => void }) {
  // a set date can be up to a year ahead (backend A-ACT); fixed when the step opens
  const [{ min, max }] = useState(() => {
    const now = Date.now();
    return { min: new Date(now + 3600000).toISOString().slice(0, 16), max: new Date(now + 365 * 86400000).toISOString().slice(0, 16) };
  });
  const options = [
    { mode: "first_use" as const, icon: Sparkles, title: "On first use", text: "The plan starts when the phone first connects abroad. Best for travel." },
    { mode: "now" as const, icon: Zap, title: "Activate now", text: "The plan starts at once; its validity counts from now." },
    { mode: "date" as const, icon: Calendar, title: "On a set date", text: "The plan starts at a chosen time, up to a year ahead." },
  ];
  return (
    <GlassCard className="flex flex-col gap-5">
      <h2 className="text-section font-semibold">Activation</h2>
      <div className="grid gap-3 md:grid-cols-3" role="radiogroup" aria-label="Activation">
        {options.map((o) => (
          <button
            key={o.mode}
            role="radio"
            aria-checked={value.mode === o.mode}
            onClick={() => onChange(o.mode === "date" ? { mode: "date", start: value.start ?? min } : { mode: o.mode })}
            className={cn("flex flex-col gap-2 rounded-card border p-4 text-left transition-colors", value.mode === o.mode ? "border-primary bg-surface-3 shadow-[0_0_0_3px_var(--primary-glow)]" : "border-border hover:bg-surface-3/50")}
          >
            <o.icon className="size-5 text-primary" strokeWidth={1.5} />
            <span className="text-body font-semibold">
              {o.title}
              {o.mode === "first_use" ? <span className="ml-2 text-small font-normal text-fg-3">Default</span> : null}
            </span>
            <span className="text-small text-fg-2">{o.text}</span>
          </button>
        ))}
      </div>
      {value.mode === "date" ? (
        <Field id="activation-date" label="Start" hint="Your time zone (Asia/Colombo).">
          <Input id="activation-date" type="datetime-local" min={min} max={max} value={(value.start ?? min).slice(0, 16)} onChange={(e) => onChange({ mode: "date", start: e.target.value })} className="sm:w-72" />
        </Field>
      ) : null}
      <StepNav onBack={onBack} onNext={onNext} nextLabel="Review" />
    </GlassCard>
  );
}

function ConfirmStep({
  plan,
  customer,
  activation,
  setActivation,
  addPlan,
  retail,
  setRetail,
  demo,
  simulate,
  setSimulate,
  sending,
  refusal,
  onBack,
  onSubmit,
}: {
  plan: CatalogueItem;
  customer: Customer | null;
  activation: ActivationInput;
  setActivation: (a: ActivationInput) => void;
  addPlan: boolean;
  retail: string;
  setRetail: (v: string) => void;
  demo: boolean;
  simulate: SimulatedOutcome;
  setSimulate: (s: SimulatedOutcome) => void;
  sending: boolean;
  refusal: string | null;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const { data: ctx } = useResource(() => esimsApi.getSellContext(plan.planId), [plan.planId]);
  const outstanding = toNumber(ctx?.outstanding) > 0;
  const blockedNew = !!ctx && !ctx.enough && !addPlan;
  const waitingAdd = !!ctx && !ctx.enough && addPlan;
  const forcedFirstUse = blockedNew && activation.mode !== "first_use";
  const refused = outstanding || !!ctx?.dailyLimitReached;
  const activationLabel = activation.mode === "first_use" ? "On first use" : activation.mode === "now" ? "Activate now" : activation.start ? `On ${formatDateTime(new Date(activation.start).toISOString())}` : "On a set date";
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <GlassCard className="flex flex-col gap-5">
        <h2 className="text-section font-semibold">Review</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Row label="Plan">
            {plan.name} · {formatPlanData(plan.dataBytes)} · {plan.validityDays} days
          </Row>
          <Row label="Works in">{plan.countries.length} countries ({plan.zoneName})</Row>
          {!addPlan ? <Row label="Customer">{customer?.name ?? <span className="text-fg-3">None</span>}</Row> : null}
          <Row label="Activation">{activationLabel}</Row>
          <Row label="Price per GB">
            <PriceRangeText perGb={plan.perGb} />
          </Row>
          <Row label="Plan total, by network">
            <span className="tabular">
              {formatMoney(plan.total.min)}–{formatMoney(plan.total.max)} <span className="text-fg-3">· typically {formatMoney(plan.total.typical)}</span>
            </span>
          </Row>
        </dl>
        <p className="text-small text-fg-3">You pay per MB actually used, at the price of the network the phone is on. The hold below reserves the most the plan can cost; whatever isn&apos;t used is released when it ends.</p>
        {ctx?.direct ? (
          <Field id="retail" label="Amount paid by the customer (optional)" hint="Recorded with the direct sale; it doesn't change any charge.">
            <Input id="retail" inputMode="decimal" value={retail} onChange={(e) => setRetail(e.target.value.replace(/[^\d.]/g, ""))} placeholder="e.g. 25.00" className="sm:w-48" />
          </Field>
        ) : null}
        {demo ? (
          <div className="rounded-control border border-dashed border-border-strong p-3">
            <Field id="simulate" label="Simulate the supplier's answer (demo only)">
              <Select value={simulate} onValueChange={(v) => setSimulate(v as SimulatedOutcome)}>
                <SelectTrigger id="simulate" className="sm:w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal answer</SelectItem>
                  <SelectItem value="needs_check">No answer (being verified)</SelectItem>
                  <SelectItem value="failed">Rejected (failed)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        ) : null}
        <StepNav onBack={onBack} />
      </GlassCard>

      <GlassCard className="flex flex-col gap-4 self-start">
        <h2 className="text-section font-semibold">{ctx?.walletName ?? "Wallet"}</h2>
        {!ctx ? (
          <Skeleton className="h-32" />
        ) : (
          <>
            <dl className="flex flex-col gap-2 text-body">
              <Money label="Available now" value={ctx.available} />
              <Money label="Hold for this plan" value={ctx.hold} negative />
              <div className="my-1 h-px bg-border" />
              <Money label="Available after" value={ctx.enough ? ctx.after : "0"} strong />
            </dl>
            {outstanding ? (
              <Notice tone="danger" icon={CircleSlash}>
                There&apos;s an outstanding amount of {formatMoney(ctx.outstanding)}. New plans can&apos;t be ordered until a top-up pays it.{" "}
                <Link href="/esim/wallet" className="font-medium text-primary underline-offset-4 hover:underline">
                  Request top-up
                </Link>
              </Notice>
            ) : ctx.dailyLimitReached ? (
              <Notice tone="danger" icon={Clock}>
                Today&apos;s sale limit is reached. Try again tomorrow.
              </Notice>
            ) : blockedNew ? (
              <Notice tone="warning" icon={AlertTriangle}>
                The eSIM is created and blocked until your wallet covers the hold. Only “On first use” activation is possible.
                {forcedFirstUse ? (
                  <Button variant="link" size="sm" className="mt-1 block px-0" onClick={() => setActivation({ mode: "first_use" })}>
                    Switch to On first use
                  </Button>
                ) : null}
              </Notice>
            ) : waitingAdd ? (
              <Notice tone="warning" icon={Clock}>
                The plan waits as Awaiting funds and starts when your wallet covers the hold.
              </Notice>
            ) : (
              <Notice tone="positive" icon={ShieldCheck}>
                Your wallet covers the hold.
              </Notice>
            )}
            {refusal ? (
              <Notice tone="danger" icon={CircleSlash}>
                {refusal}
              </Notice>
            ) : null}
            <Button size="lg" disabled={refused || forcedFirstUse || sending} onClick={onSubmit}>
              {sending ? "Sending…" : addPlan ? "Add plan" : "Sell eSIM"}
            </Button>
          </>
        )}
      </GlassCard>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-small text-fg-3">{label}</dt>
      <dd className="text-body">{children}</dd>
    </div>
  );
}

function Money({ label, value, negative, strong }: { label: string; value: string; negative?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-fg-2">{label}</dt>
      <dd className={cn("tabular", strong && "text-section font-semibold")}>
        {negative ? "−" : ""}
        {formatMoney(value)}
      </dd>
    </div>
  );
}

function Notice({ tone, icon: Icon, children }: { tone: "danger" | "warning" | "positive"; icon: typeof Check; children: React.ReactNode }) {
  const c = tone === "danger" ? "var(--danger)" : tone === "warning" ? "var(--warning)" : "var(--accent)";
  return (
    <div className="flex items-start gap-2.5 rounded-control border px-3 py-2.5 text-small" style={{ borderColor: `color-mix(in oklab, ${c} 40%, transparent)`, background: `color-mix(in oklab, ${c} 8%, transparent)` }} role={tone === "danger" ? "alert" : "status"}>
      <Icon className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} style={{ color: c }} />
      <div>{children}</div>
    </div>
  );
}

function StepNav({ onBack, onNext, nextLabel }: { onBack: () => void; onNext?: () => void; nextLabel?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft strokeWidth={1.5} />
        Back
      </Button>
      {onNext ? (
        <Button onClick={onNext} arrow>
          {nextLabel ?? "Continue"}
        </Button>
      ) : null}
    </div>
  );
}

function SellResultView({ result, addPlan, esimId, onAgain }: { result: SellResult; addPlan: boolean; esimId: string | null; onAgain: () => void }) {
  const [emailQr, setEmailQr] = useState(false);
  const qr = useRef<HTMLDivElement>(null);
  const reveal = useMemo(() => "animate-rise", []);
  if (result.outcome === "needs_check")
    return (
      <ResultFrame icon={Clock} tone="warning" title="Being verified" text="The supplier didn't answer in time. Don't sell again: we're checking with the supplier, and the order updates once it's confirmed.">
        <Button asChild>
          <Link href={`/esim/orders/${result.orderId}`}>Open the order</Link>
        </Button>
      </ResultFrame>
    );
  if (result.outcome === "failed")
    return (
      <ResultFrame icon={CircleSlash} tone="danger" title="The sale failed" text={`${result.reason.split(".")[0]}. No money was taken; the hold was released.`}>
        <Button onClick={onAgain}>Try again</Button>
      </ResultFrame>
    );
  if (result.outcome === "awaiting_funds")
    return (
      <ResultFrame icon={Clock} tone="warning" title={`${result.planName} is waiting for funds`} text="The plan waits as Awaiting funds and starts when your wallet covers the hold. Plans are funded oldest first.">
        <Button asChild>
          <Link href="/esim/wallet">Request top-up</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`/esim/esims/${result.esimId}`}>Open the eSIM</Link>
        </Button>
      </ResultFrame>
    );
  return (
    <div className={cn("grid gap-6 lg:grid-cols-[minmax(0,440px)_1fr] lg:items-start", reveal)}>
      <div className="mx-auto w-full max-w-[440px] lg:sticky lg:top-6 lg:pt-6">
        <EsimCard iccid={result.iccid} planName={result.planName} lpa={result.lpa} usedBytes={0} limitBytes={result.limitBytes} statusLabel={result.funding === "waiting" ? "Blocked until funded" : "Ready to install"} />
      </div>
      <GlassCard className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-[color-mix(in_oklab,var(--accent)_16%,transparent)] text-accent">
            <Check className="size-5" strokeWidth={2} />
          </span>
          <div>
            <h1 className="text-title font-semibold">{addPlan ? "Plan added" : "eSIM sold"}</h1>
            <p className="text-body text-fg-2">{result.planName}</p>
          </div>
        </div>
        {result.funding === "waiting" ? (
          <Notice tone="warning" icon={AlertTriangle}>
            The eSIM is blocked until your wallet covers the hold. The customer can install it now; data starts once it&apos;s funded.{" "}
            <Link href="/esim/wallet" className="font-medium text-primary underline-offset-4 hover:underline">
              Request top-up
            </Link>
          </Notice>
        ) : null}
        <dl className="flex flex-col gap-3">
          {(
            [
              ["ICCID", result.iccid],
              ["Activation code", result.activationCode],
              ["SM-DP+ address", result.smdpAddress],
              ["LPA string", result.lpa],
            ] as const
          ).map(([l, v]) => (
            <div key={l}>
              <dt className="text-small text-fg-3">{l}</dt>
              <dd className="flex items-center gap-1 font-mono text-small">
                <span className="break-all">{v}</span>
                <CopyButton value={v} label={`Copy ${l}`} />
              </dd>
            </div>
          ))}
        </dl>
        <div ref={qr} className="hidden" aria-hidden="true">
          <QRCodeCanvas value={result.lpa} size={512} marginSize={4} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              const c = qr.current?.querySelector("canvas");
              if (!c) return;
              const a = document.createElement("a");
              a.href = c.toDataURL("image/png");
              a.download = `esim-${result.iccid}.png`;
              a.click();
              toast.success("QR code downloaded");
            }}
          >
            <Download strokeWidth={1.5} />
            Download QR code
          </Button>
          <Button variant="secondary" onClick={() => setEmailQr(true)}>
            <Mail strokeWidth={1.5} />
            Email QR code
          </Button>
          <Button asChild>
            <Link href={`/esim/esims/${result.esimId}`}>
              Open the eSIM
              <ArrowRight strokeWidth={1.5} />
            </Link>
          </Button>
        </div>
        {!addPlan ? (
          <Button variant="link" className="self-start px-0" onClick={onAgain}>
            Sell another eSIM
          </Button>
        ) : esimId ? null : null}
      </GlassCard>
      <EmailQrDialog esimId={result.esimId} open={emailQr} onOpenChange={setEmailQr} defaultEmail={null} />
    </div>
  );
}

function ResultFrame({ icon: Icon, tone, title, text, children }: { icon: typeof Check; tone: "warning" | "danger"; title: string; text: string; children: React.ReactNode }) {
  const c = tone === "danger" ? "var(--danger)" : "var(--warning)";
  return (
    <GlassCard className="mx-auto flex max-w-xl flex-col items-center gap-4 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-full" style={{ background: `color-mix(in oklab, ${c} 14%, transparent)`, color: c }}>
        <Icon className="size-7" strokeWidth={1.5} />
      </span>
      <h1 className="text-title font-semibold">{title}</h1>
      <p className="max-w-md text-body text-fg-2">{text}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">{children}</div>
    </GlassCard>
  );
}
