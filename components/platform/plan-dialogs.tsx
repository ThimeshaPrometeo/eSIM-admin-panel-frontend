"use client";

import { useId, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAction } from "@/hooks/use-action";
import { useResource } from "@/hooks/use-resource";
import { catalogueApi, type PlanInput } from "@/lib/api/catalogue";
import { formatMoney, formatPerGb } from "@/lib/platform/money";
import type { Plan } from "@/lib/platform/types";
import { BYTES } from "@/lib/platform/units";

/** Create or edit a plan (spec 8.10), admin only. The hold and the price spread update live. */
export function PlanFormDialog({ open, onOpenChange, plan }: { open: boolean; onOpenChange: (o: boolean) => void; plan?: Plan | null }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">{open ? <PlanForm plan={plan ?? null} onDone={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  );
}

/** The form lives inside the dialog content, so it starts fresh every time the dialog opens. */
function PlanForm({ plan, onDone }: { plan: Plan | null; onDone: () => void }) {
  const id = useId();
  const zones = useResource(() => catalogueApi.listZones(), ["zones"]);
  const gb = plan ? plan.dataBytes / BYTES.GB : null;
  const [name, setName] = useState(plan?.name ?? "");
  const [zoneId, setZoneId] = useState(plan?.zoneId ?? "");
  const [unit, setUnit] = useState<"MB" | "GB">(gb !== null && !Number.isInteger(gb) ? "MB" : "GB");
  const [amount, setAmount] = useState(plan ? String(gb !== null && Number.isInteger(gb) ? gb : plan.dataBytes / BYTES.MB) : "");
  const [days, setDays] = useState(plan ? String(plan.validityDays) : "");
  const [override, setOverride] = useState(!!plan?.holdOverride);
  const [holdText, setHoldText] = useState(plan?.holdOverride ?? "");
  const [status, setStatus] = useState<Plan["status"]>(plan?.status ?? "draft");
  const { run, pending } = useAction();

  const dataBytes = Math.round((Number(amount) || 0) * BYTES[unit]);
  const hold = override ? Number(holdText) : null;
  const preview = useResource(() => catalogueApi.pricingPreview({ zoneId, dataBytes, holdOverride: hold }), [zoneId, dataBytes, hold], !!zoneId && dataBytes > 0);
  const zone = zones.data?.find((z) => z.id === zoneId);
  const valid = name.trim().length >= 2 && !!zone?.usable && dataBytes > 0 && Number(days) >= 1 && (!override || Number(holdText) > 0);

  const submit = async () => {
    const input: PlanInput = { name, zoneId, dataBytes, validityDays: Number(days), holdOverride: override ? Number(holdText) : null, status };
    const r = await run(() => (plan ? catalogueApi.updatePlan(plan.id, input) : catalogueApi.createPlan(input)), { success: plan ? "Plan saved" : "Plan created" });
    if (r.ok) onDone();
  };

  const p = preview.data;
  return (
    <>
        <DialogHeader>
          <DialogTitle>{plan ? `Edit ${plan.name}` : "Create plan"}</DialogTitle>
          <DialogDescription>Plans are billed per MB used. The hold reserves the most a plan can cost from the buyer&apos;s wallet.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${id}-name`} label="Name">
            <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Italy 3 GB" />
          </Field>
          <Field id={`${id}-zone`} label="Zone" hint={zone && !zone.usable ? undefined : "Zones with unpriced networks can't be used."} error={zone && !zone.usable ? `This zone has ${zone.unpricedNetworks} networks without a price.` : undefined}>
            <Select value={zoneId} onValueChange={setZoneId}>
              <SelectTrigger id={`${id}-zone`}>
                <SelectValue placeholder="Choose a zone" />
              </SelectTrigger>
              <SelectContent>
                {(zones.data ?? []).map((z) => (
                  <SelectItem key={z.id} value={z.id} disabled={!z.usable}>
                    {z.name}
                    {z.demoZone ? " (demo zone)" : ""} · {z.countryCount} countries{!z.usable ? ` · ${z.unpricedNetworks} unpriced` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id={`${id}-data`} label="Data">
            <div className="flex gap-2">
              <Input id={`${id}-data`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="3" />
              <Select value={unit} onValueChange={(u) => setUnit(u as "MB" | "GB")}>
                <SelectTrigger className="w-24" aria-label="Unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MB">MB</SelectItem>
                  <SelectItem value="GB">GB</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Field>
          <Field id={`${id}-days`} label="Validity (days)">
            <Input id={`${id}-days`} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} placeholder="15" />
          </Field>
          <Field id={`${id}-status`} label="Status">
            <Select value={status} onValueChange={(v) => setStatus(v as Plan["status"])}>
              <SelectTrigger id={`${id}-status`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active (can be sold)</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-override`} className="flex items-center justify-between text-small font-medium text-fg-2">
              Hold override
              <Switch id={`${id}-override`} checked={override} onCheckedChange={setOverride} />
            </label>
            <Input aria-label="Hold amount in EUR" inputMode="decimal" disabled={!override} value={holdText} onChange={(e) => setHoldText(e.target.value.replace(/[^\d.]/g, ""))} placeholder={p?.defaultHold ? `Default ${formatMoney(p.defaultHold)}` : "Amount in EUR"} />
          </div>
        </div>

        <div className="mt-5 rounded-control border border-border bg-surface-2/60 p-4 text-body" aria-live="polite">
          {!zoneId || dataBytes <= 0 ? (
            <p className="text-fg-3">Choose a zone and the data amount to see the cost range and the hold.</p>
          ) : !p ? (
            <p className="text-fg-3">Calculating…</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-small text-fg-3">Supplier cost per GB</p>
                <p className="tabular">
                  {p.costPerMb ? (
                    <>
                      {formatPerGb(p.costPerMb.min)}–{formatPerGb(p.costPerMb.max)} <span className="text-fg-3">· typically {formatPerGb(p.costPerMb.typical)}</span>
                    </>
                  ) : (
                    "No priced networks"
                  )}
                </p>
              </div>
              <div>
                <p className="text-small text-fg-3">{override ? "Hold (override)" : "Calculated hold at the default markup"}</p>
                <p className="tabular">
                  <span className="font-semibold">{p.defaultHold ? formatMoney(p.defaultHold) : "—"}</span>
                  {p.holdRange && !override ? <span className="text-fg-3"> · {formatMoney(p.holdRange.min)}–{formatMoney(p.holdRange.max)} across resellers</span> : null}
                </p>
              </div>
              {p.spreadWarning ? (
                <p className="flex items-start gap-2 rounded-control border border-[color-mix(in_oklab,var(--warning)_40%,transparent)] bg-[color-mix(in_oklab,var(--warning)_8%,transparent)] p-3 text-small sm:col-span-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" strokeWidth={1.5} />
                  <span>
                    Large price spread: the dearest network costs {p.spreadRatio!.toFixed(1)}× the cheapest (warning above {p.spreadThreshold}×). The hold is sized for the dearest network, so it will be much higher than typical use. Consider a hold override.
                  </span>
                </p>
              ) : null}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button disabled={!valid || pending} onClick={submit}>
            {plan ? "Save plan" : "Create plan"}
          </Button>
        </DialogFooter>
    </>
  );
}
