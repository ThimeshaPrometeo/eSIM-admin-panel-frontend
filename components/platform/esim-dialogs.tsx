"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAction } from "@/hooks/use-action";
import { esimsApi } from "@/lib/api/esims";
import { formatDate } from "@/lib/platform/dates";
import type { EsimPlan } from "@/lib/platform/types";
import { BYTES, formatPlanData } from "@/lib/platform/units";

/** Extend a plan's expiry (admin/staff, reason required; spec 8.4). */
export function ExtendPlanDialog({ esimId, plan, onOpenChange }: { esimId: string; plan: EsimPlan | null; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={!!plan} onOpenChange={onOpenChange}>
      <DialogContent>{plan ? <ExtendForm esimId={esimId} plan={plan} onDone={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  );
}

function ExtendForm({ esimId, plan, onDone }: { esimId: string; plan: EsimPlan; onDone: () => void }) {
  const id = useId();
  const [days, setDays] = useState("7");
  const [reason, setReason] = useState("");
  const { run, pending } = useAction();
  const base = plan.expiresAt ? new Date(plan.expiresAt) : new Date();
  const next = new Date(base.getTime() + Number(days || 0) * 86400000).toISOString();
  return (
    <>
      <DialogHeader>
        <DialogTitle>Extend {plan.name}</DialogTitle>
        <DialogDescription>Now expires {formatDate(plan.expiresAt)}. The reason is kept in the audit log.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-d`} label="Extra days" hint={`New expiry: ${formatDate(next)}`}>
          <Input id={`${id}-d`} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field id={`${id}-r`} label="Reason">
          <Textarea id={`${id}-r`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer's trip extended" />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!(Number(days) > 0) || reason.trim().length < 3 || pending}
          onClick={async () => {
            const r = await run(() => esimsApi.extendPackage(esimId, plan.id, { days: Number(days), reason }), { success: "Plan extended", description: `Now expires ${formatDate(next)}.` });
            if (r.ok) onDone();
          }}
        >
          Extend plan
        </Button>
      </DialogFooter>
    </>
  );
}

/** Add data to a plan (admin/staff, reason required). The hold grows first; shows the new total. */
export function AddDataDialog({ esimId, plan, onOpenChange }: { esimId: string; plan: EsimPlan | null; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={!!plan} onOpenChange={onOpenChange}>
      <DialogContent>{plan ? <AddDataForm esimId={esimId} plan={plan} onDone={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  );
}

function AddDataForm({ esimId, plan, onDone }: { esimId: string; plan: EsimPlan; onDone: () => void }) {
  const id = useId();
  const [amount, setAmount] = useState("1");
  const [unit, setUnit] = useState<"MB" | "GB">("GB");
  const [reason, setReason] = useState("");
  const { run, pending } = useAction();
  const add = Math.round(Number(amount || 0) * BYTES[unit]);
  return (
    <>
      <DialogHeader>
        <DialogTitle>Add data to {plan.name}</DialogTitle>
        <DialogDescription>The plan&apos;s hold grows first; if the wallet can&apos;t cover it, nothing changes.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-a`} label="Add" hint={`New total: ${formatPlanData(plan.limitBytes + add)}`}>
          <div className="flex gap-2">
            <Input id={`${id}-a`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
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
        <Field id={`${id}-r`} label="Reason">
          <Textarea id={`${id}-r`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Goodwill after a network outage" />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!(add > 0) || reason.trim().length < 3 || pending}
          onClick={async () => {
            const r = await run(() => esimsApi.addPackageData(esimId, plan.id, { addBytes: add, reason }), { success: "Data added", description: `${plan.name} now has ${formatPlanData(plan.limitBytes + add)}.` });
            if (r.ok) onDone();
          }}
        >
          Add data
        </Button>
      </DialogFooter>
    </>
  );
}

/** Email the QR code (backlog BB-5). */
export function EmailQrDialog({ esimId, open, onOpenChange, defaultEmail }: { esimId: string; open: boolean; onOpenChange: (o: boolean) => void; defaultEmail: string | null }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open ? <EmailQrForm esimId={esimId} defaultEmail={defaultEmail} onDone={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  );
}

function EmailQrForm({ esimId, defaultEmail, onDone }: { esimId: string; defaultEmail: string | null; onDone: () => void }) {
  const id = useId();
  const [email, setEmail] = useState(defaultEmail ?? "");
  const { run, pending } = useAction();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return (
    <>
      <DialogHeader>
        <DialogTitle>Email the QR code</DialogTitle>
        <DialogDescription>The customer scans it to install the eSIM. It includes the manual install details too.</DialogDescription>
      </DialogHeader>
      <Field id={`${id}-e`} label="Email">
        <Input id={`${id}-e`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!valid || pending}
          onClick={async () => {
            const r = await run(() => esimsApi.emailEsimQr(esimId, email), { success: "QR code emailed", description: `Sent to ${email}.` });
            if (r.ok) onDone();
          }}
        >
          Email QR code
        </Button>
      </DialogFooter>
    </>
  );
}
