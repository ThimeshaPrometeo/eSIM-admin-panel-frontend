"use client";

import { FitPage, FitScroll } from "@/components/platform/fit-page";
import { useId, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/platform/confirm-dialog";
import { PriceRangeText } from "@/components/platform/fields";
import { GlassCard } from "@/components/platform/glass-card";
import { EmptyState, PageHeader } from "@/components/platform/primitives";
import { StatusChip } from "@/components/platform/status-chip";
import { useAction } from "@/hooks/use-action";
import { usePermission } from "@/hooks/use-permission";
import { useResource } from "@/hooks/use-resource";
import { catalogueApi } from "@/lib/api/catalogue";
import { formatMoney } from "@/lib/platform/money";
import { PLAN_STATUS } from "@/lib/platform/status-labels";
import type { ResellerPlan } from "@/lib/platform/types";
import { formatPlanData } from "@/lib/platform/units";

/** My plans (spec 8.11): resellers' own named versions of plans; the selling price is informational. */
export function MyPlansClient() {
  const { me, rules } = usePermission();
  const canEdit = rules.canEditResellerPlans(me);
  const plans = useResource(() => catalogueApi.listResellerPlans(), ["my-plans"]);
  const catalogue = useResource(() => catalogueApi.listPlansCatalogue(), ["catalogue"]);
  const [editing, setEditing] = useState<ResellerPlan | null | undefined>(undefined);
  const [removing, setRemoving] = useState<ResellerPlan | null>(null);
  const { run } = useAction();

  const base = (planId: string) => catalogue.data?.find((c) => c.planId === planId && !c.resellerPlanId);

  return (
    <FitPage>
      <PageHeader
        title="My plans"
        description="Name plans your way and note what you charge your customers. You're still billed per MB used at your prices."
        actions={
          canEdit ? (
            <Button onClick={() => setEditing(null)}>
              <Plus strokeWidth={1.75} />
              New plan
            </Button>
          ) : null
        }
      />
<FitScroll>
      {plans.loading && !plans.data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-52 rounded-card" />
          ))}
        </div>
      ) : !plans.data?.length ? (
        <GlassCard>
          <EmptyState illustration="sim" title="No plans of your own yet" description="Give a plan your own name and selling price, then sell it like any other." action={canEdit ? <Button onClick={() => setEditing(null)}>New plan</Button> : undefined} />
        </GlassCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.data.map((p) => {
            const b = base(p.planId);
            return (
              <GlassCard key={p.id} interactive className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-section font-semibold">{p.name}</h2>
                    <p className="text-small text-fg-3">
                      Based on {p.planName} · {p.zoneName}
                    </p>
                  </div>
                  <StatusChip status={PLAN_STATUS[p.status]} />
                </div>
                {p.description ? <p className="text-body text-fg-2">{p.description}</p> : null}
                <dl className="grid grid-cols-3 gap-3">
                  <div>
                    <dt className="text-small text-fg-3">Data</dt>
                    <dd className="text-body font-medium">{formatPlanData(p.dataBytes)}</dd>
                  </div>
                  <div>
                    <dt className="text-small text-fg-3">Validity</dt>
                    <dd className="text-body font-medium">{p.validityDays} days</dd>
                  </div>
                  <div>
                    <dt className="text-small text-fg-3">You charge</dt>
                    <dd className="text-body font-medium tabular">{formatMoney(p.sellingPrice)}</dd>
                  </div>
                </dl>
                {b ? (
                  <div className="rounded-control border border-border px-3 py-2 text-small">
                    <p className="text-fg-3">Your cost per GB</p>
                    <PriceRangeText perGb={b.perGb} />
                    <p className="mt-1 text-fg-3">
                      Hold when sold: <span className="text-fg tabular">{formatMoney(b.hold)}</span>
                    </p>
                  </div>
                ) : null}
                {canEdit && p.status === "active" ? (
                  <div className="mt-auto flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setEditing(p)}>
                      <Pencil strokeWidth={1.5} />
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setRemoving(p)}>
                      <Trash2 strokeWidth={1.5} />
                      Remove
                    </Button>
                  </div>
                ) : null}
              </GlassCard>
            );
          })}
        </div>
      )}
      <Dialog open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)}>
        <DialogContent>{editing !== undefined ? <ResellerPlanForm plan={editing} options={(catalogue.data ?? []).filter((c) => !c.resellerPlanId)} onDone={() => setEditing(undefined)} /> : null}</DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing?.name ?? "plan"}?`}
        description="It won't be offered when selling any more. eSIMs already sold keep their plan."
        confirmLabel="Remove plan"
        destructive
        onConfirm={async () => {
          const r = await run(() => catalogueApi.deleteResellerPlan(removing!.id), { success: "Plan removed" });
          if (r.ok) setRemoving(null);
        }}
      />
      </FitScroll>
    </FitPage>
  );
}

function ResellerPlanForm({ plan, options, onDone }: { plan: ResellerPlan | null; options: { planId: string; name: string }[]; onDone: () => void }) {
  const id = useId();
  const [planId, setPlanId] = useState(plan?.planId ?? "");
  const [name, setName] = useState(plan?.name ?? "");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [price, setPrice] = useState(plan?.sellingPrice ?? "");
  const { run, pending } = useAction();
  const valid = !!planId && name.trim().length >= 2 && Number(price) >= 0 && price !== "";
  return (
    <>
      <DialogHeader>
        <DialogTitle>{plan ? `Edit ${plan.name}` : "New plan"}</DialogTitle>
        <DialogDescription>The selling price is for your records; you&apos;re billed per MB used.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <Field id={`${id}-base`} label="Based on">
          <Select value={planId} onValueChange={setPlanId}>
            <SelectTrigger id={`${id}-base`}>
              <SelectValue placeholder="Choose a plan" />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.planId} value={o.planId}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id={`${id}-name`} label="Your name for it">
          <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rome weekend" />
        </Field>
        <Field id={`${id}-desc`} label="Description (optional)">
          <Textarea id={`${id}-desc`} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field id={`${id}-price`} label="Your selling price (EUR)" hint="Informational only.">
          <Input id={`${id}-price`} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} placeholder="19.00" />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!valid || pending}
          onClick={async () => {
            const input = { planId, name, description, sellingPrice: Number(price) };
            const r = await run(() => (plan ? catalogueApi.updateResellerPlan(plan.id, input) : catalogueApi.createResellerPlan(input).then(() => undefined)), { success: plan ? "Plan saved" : "Plan created" });
            if (r.ok) onDone();
          }}
        >
          {plan ? "Save plan" : "Create plan"}
        </Button>
      </DialogFooter>
    </>
  );
}
