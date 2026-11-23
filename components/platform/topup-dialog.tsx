"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { useAction } from "@/hooks/use-action";
import { walletsApi } from "@/lib/api/wallets";
import { formatMoney, toNumber } from "@/lib/platform/money";
import type { Wallet } from "@/lib/platform/types";

/** Request a top-up (spec 8.19): amount, bank transfer reference, note. */
export function TopupRequestForm({ wallet, onDone }: { wallet: Wallet; onDone: () => void }) {
  const id = useId();
  const need = toNumber(wallet.outstanding) + toNumber(wallet.waitingAmount);
  const [amount, setAmount] = useState(need > 0 ? String(Math.ceil(need / 10) * 10) : "");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const { run, pending } = useAction();
  const n = Number(amount);
  return (
    <>
      <DialogHeader>
        <DialogTitle>Request top-up</DialogTitle>
        <DialogDescription>Transfer the amount to the company&apos;s bank account, then send the reference here. An administrator approves it and the money is added to your wallet.</DialogDescription>
      </DialogHeader>
      {need > 0 ? (
        <p className="mb-4 rounded-control border border-border bg-surface-2/60 px-3 py-2 text-small text-fg-2">
          {toNumber(wallet.outstanding) > 0 ? `${formatMoney(wallet.outstanding)} outstanding is paid first. ` : ""}
          {wallet.waitingPlans ? `${formatMoney(wallet.waitingAmount)} starts the ${wallet.waitingPlans} waiting plan${wallet.waitingPlans > 1 ? "s" : ""}.` : ""}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-a`} label="Amount (EUR)">
          <Input id={`${id}-a`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="250.00" />
        </Field>
        <Field id={`${id}-r`} label="Bank transfer reference">
          <Input id={`${id}-r`} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. BT40221873" />
        </Field>
        <div className="sm:col-span-2">
          <Field id={`${id}-n`} label="Note (optional)">
            <Textarea id={`${id}-n`} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!(n > 0) || pending}
          onClick={async () => {
            const r = await run(() => walletsApi.createTopupRequest({ amount: n, paymentReference: reference, note }), { success: "Top-up requested", description: "You'll get a notification when it's approved." });
            if (r.ok) onDone();
          }}
        >
          Request top-up
        </Button>
      </DialogFooter>
    </>
  );
}
