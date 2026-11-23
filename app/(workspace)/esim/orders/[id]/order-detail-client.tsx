"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ArrowLeft, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Detail } from "@/components/platform/fields";
import { GlassCard } from "@/components/platform/glass-card";
import { EmptyState } from "@/components/platform/primitives";
import { StatusChip } from "@/components/platform/status-chip";
import { useAction } from "@/hooks/use-action";
import { usePermission } from "@/hooks/use-permission";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/errors";
import { esimsApi } from "@/lib/api/esims";
import { formatDateTime } from "@/lib/platform/dates";
import { formatMoney } from "@/lib/platform/money";
import { ORDER_STATUS } from "@/lib/platform/status";

/** Order detail (spec 8.6): admins resolve "Being verified" with the ICCID; staff ask the supplier again. */
export function OrderDetailClient({ id }: { id: string }) {
  const { me, rules } = usePermission();
  const { data: o, error } = useResource(() => esimsApi.getOrder(id), [id]);
  const [resolving, setResolving] = useState<"completed" | "failed" | null>(null);
  const { run, pending } = useAction();
  if (error) return <EmptyState illustration="sim" title="Order not found" description={errorMessage(error)} />;
  const verifying = o?.status === "needs_check";
  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href="/esim/orders">
          <ArrowLeft strokeWidth={1.5} />
          Orders
        </Link>
      </Button>
      {!o ? (
        <Skeleton className="h-48" />
      ) : (
        <GlassCard className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-title font-semibold">{o.type === "new_esim" ? "New eSIM" : "Add plan"}: {o.planName}</h1>
                <StatusChip status={ORDER_STATUS[o.status]} />
              </div>
              <p className="mt-1 font-mono text-small text-fg-3">{o.id.toUpperCase()}</p>
            </div>
            {o.esimId ? (
              <Button asChild variant="secondary">
                <Link href={`/esim/esims/${o.esimId}`}>Open the eSIM</Link>
              </Button>
            ) : null}
          </div>
          <dl className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            <Detail label="Created">{formatDateTime(o.createdAt)}</Detail>
            <Detail label="By">{o.userName}</Detail>
            <Detail label="Reseller">{o.resellerName ?? "Direct sale"}</Detail>
            <Detail label="Hold">{formatMoney(o.holdAmount)}</Detail>
            {o.iccid ? <Detail label="ICCID"><span className="font-mono text-small">{o.iccid}</span></Detail> : null}
            {o.failureReason ? <Detail label="Reason" className="col-span-2">{o.failureReason}</Detail> : null}
          </dl>
          {verifying ? (
            <div className="rounded-control border border-[color-mix(in_oklab,var(--warning)_40%,transparent)] bg-[color-mix(in_oklab,var(--warning)_8%,transparent)] p-4">
              <p className="text-body">The supplier didn&apos;t confirm this order. The hold stays in place until it&apos;s resolved. Don&apos;t sell again to the same customer meanwhile.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {rules.canCheckOrder(me) ? (
                  <Button
                    variant="secondary"
                    disabled={pending}
                    onClick={() => run(() => esimsApi.checkOrder(o.id), { success: (r) => (r.matched ? "Match found" : "Checked with the supplier"), description: (r) => (r.matched ? undefined : "No eSIM matched yet. Try again later, or resolve it by hand.") })}
                  >
                    <RefreshCw strokeWidth={1.5} />
                    Check now
                  </Button>
                ) : null}
                {rules.canResolveOrder(me) ? (
                  <>
                    <Button onClick={() => setResolving("completed")}>
                      <CheckCircle2 strokeWidth={1.5} />
                      Resolve as completed
                    </Button>
                    <Button variant="ghost" onClick={() => setResolving("failed")}>
                      <XCircle strokeWidth={1.5} />
                      Resolve as failed
                    </Button>
                  </>
                ) : (
                  <p className="text-small text-fg-2">Only an administrator can resolve it.</p>
                )}
              </div>
            </div>
          ) : null}
        </GlassCard>
      )}
      <Dialog open={!!resolving} onOpenChange={(v) => !v && setResolving(null)}>
        <DialogContent>{resolving && o ? <ResolveForm orderId={o.id} outcome={resolving} onDone={() => setResolving(null)} /> : null}</DialogContent>
      </Dialog>
    </div>
  );
}

function ResolveForm({ orderId, outcome, onDone }: { orderId: string; outcome: "completed" | "failed"; onDone: () => void }) {
  const id = useId();
  const [iccid, setIccid] = useState("");
  const [note, setNote] = useState("");
  const { run, pending } = useAction();
  return (
    <>
      <DialogHeader>
        <DialogTitle>{outcome === "completed" ? "Resolve as completed" : "Resolve as failed"}</DialogTitle>
        <DialogDescription>
          {outcome === "completed" ? "Enter the ICCID the supplier gave this plan. It's checked with the supplier before the order completes." : "The hold is released; nothing was charged."}
        </DialogDescription>
      </DialogHeader>
      {outcome === "completed" ? (
        <Field id={`${id}-i`} label="ICCID" hint="19 or 20 digits.">
          <Input id={`${id}-i`} inputMode="numeric" className="font-mono" value={iccid} onChange={(e) => setIccid(e.target.value.replace(/\D/g, ""))} />
        </Field>
      ) : (
        <Field id={`${id}-n`} label="Note">
          <Textarea id={`${id}-n`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What the supplier said" />
        </Field>
      )}
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          variant={outcome === "failed" ? "destructive" : "primary"}
          disabled={pending || (outcome === "completed" ? !/^\d{19,20}$/.test(iccid) : note.trim().length < 3)}
          onClick={async () => {
            const r = await run(() => esimsApi.resolveOrder(orderId, outcome === "completed" ? { outcome, iccid } : { outcome, note }), { success: outcome === "completed" ? "Order completed" : "Order failed; hold released" });
            if (r.ok) onDone();
          }}
        >
          {outcome === "completed" ? "Complete order" : "Fail order"}
        </Button>
      </DialogFooter>
    </>
  );
}
