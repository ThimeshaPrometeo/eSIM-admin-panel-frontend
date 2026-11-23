"use client";

import { useId, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAction } from "@/hooks/use-action";
import { useResource } from "@/hooks/use-resource";
import { catalogueApi } from "@/lib/api/catalogue";
import { peopleApi } from "@/lib/api/people";
import { formatPerGb } from "@/lib/platform/money";
import type { Discount } from "@/lib/platform/types";

/** Create or edit a discount (spec 8.14), admin only, with a live price preview on a sample network. */
export function DiscountForm({ discount, resellerId: fixedReseller, onDone }: { discount: Discount | null; resellerId?: string; onDone: () => void }) {
  const id = useId();
  const resellers = useResource(() => peopleApi.listResellerOptions(), ["reseller-options"]);
  const plans = useResource(() => catalogueApi.listPlans({ status: "active" }), ["active-plans"]);
  const [resellerId, setResellerId] = useState(discount?.resellerId ?? fixedReseller ?? "");
  const [planId, setPlanId] = useState<string>(discount?.planId ?? "all");
  const [percent, setPercent] = useState(discount ? String(discount.percent) : "");
  const pct = Number(percent);
  const preview = useResource(
    () => catalogueApi.discountPreview({ resellerId, planId: planId === "all" ? null : planId, percent: pct }),
    [resellerId, planId, pct],
    !!resellerId && percent !== "" && pct >= 0 && pct < 100,
  );
  const { run, pending } = useAction();
  const valid = !!resellerId && percent !== "" && pct > 0 && pct < 100;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{discount ? "Edit discount" : "Add discount"}</DialogTitle>
        <DialogDescription>Applied to the reseller&apos;s price per MB. A discount on one plan wins over a reseller-wide one.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-r`} label="Reseller">
          <Select value={resellerId} onValueChange={setResellerId} disabled={!!discount || !!fixedReseller}>
            <SelectTrigger id={`${id}-r`}>
              <SelectValue placeholder="Choose a reseller" />
            </SelectTrigger>
            <SelectContent>
              {(resellers.data ?? []).map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id={`${id}-p`} label="Applies to">
          <Select value={planId} onValueChange={setPlanId} disabled={!!discount}>
            <SelectTrigger id={`${id}-p`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All plans</SelectItem>
              {(plans.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id={`${id}-pct`} label="Discount (%)">
          <Input id={`${id}-pct`} inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value.replace(/[^\d.]/g, ""))} placeholder="5" />
        </Field>
      </div>
      <div className="mt-5 rounded-control border border-border bg-surface-2/60 p-4" aria-live="polite">
        {preview.data ? (
          <>
            <p className="text-small text-fg-3">Price per GB on {preview.data.network}</p>
            <p className="mt-1 flex items-center gap-2 text-section font-semibold tabular">
              <span className="text-fg-2 line-through decoration-fg-3/60">{formatPerGb(preview.data.beforePerGb / 1024)}</span>
              <ArrowRight className="size-4 text-fg-3" strokeWidth={1.5} />
              <span>{formatPerGb(preview.data.afterPerGb / 1024)}</span>
            </p>
            <p className="mt-1 text-small text-fg-3">Now {preview.data.currentPercent}% off; the reseller sees only the result, never the markup or the discount rate behind it.</p>
          </>
        ) : (
          <p className="text-body text-fg-3">Choose a reseller and a percentage to preview the price.</p>
        )}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!valid || pending}
          onClick={async () => {
            const r = await run(
              () => (discount ? catalogueApi.updateDiscount(discount.id, { percent: pct }) : catalogueApi.createDiscount({ resellerId, planId: planId === "all" ? null : planId, percent: pct })),
              { success: discount ? "Discount saved" : "Discount added" },
            );
            if (r.ok) onDone();
          }}
        >
          {discount ? "Save discount" : "Add discount"}
        </Button>
      </DialogFooter>
    </>
  );
}
