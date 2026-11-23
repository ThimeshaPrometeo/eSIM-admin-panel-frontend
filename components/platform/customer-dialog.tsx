"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { useAction } from "@/hooks/use-action";
import { operationsApi } from "@/lib/api/operations";
import { peopleApi } from "@/lib/api/people";
import type { Customer } from "@/lib/platform/types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Add or edit an end customer (spec 8.16). New customers belong to the signed-in reseller, or are direct for admin/staff. */
export function CustomerDialog({ open, customer, onOpenChange }: { open: boolean; customer: Customer | null; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">{open ? <CustomerForm customer={customer} onDone={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  );
}

function CustomerForm({ customer, onDone }: { customer: Customer | null; onDone: () => void }) {
  const id = useId();
  const [name, setName] = useState(customer?.name ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const { run, pending } = useAction();
  const emailError = email.trim() && !EMAIL.test(email.trim()) ? "Enter a valid email address." : undefined;
  const valid = name.trim().length > 1 && !emailError;
  return (
    <>
      <DialogHeader>
        <DialogTitle>{customer ? "Edit customer" : "Add customer"}</DialogTitle>
        <DialogDescription>Used on the eSIM, on QR code emails and in search. The phone number is for contact only.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <Field id={`${id}-n`} label="Full name">
          <Input id={`${id}-n`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </Field>
        <Field id={`${id}-e`} label="Email" error={emailError}>
          <Input id={`${id}-e`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
        </Field>
        <Field id={`${id}-p`} label="Phone">
          <Input id={`${id}-p`} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="off" />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!valid || pending}
          onClick={async () => {
            const input = { name, email, phone };
            const r = await run(() => (customer ? operationsApi.updateCustomer(customer.id, input) : peopleApi.createCustomer(input)), { success: customer ? "Customer saved" : "Customer added" });
            if (r.ok) onDone();
          }}
        >
          {customer ? "Save customer" : "Add customer"}
        </Button>
      </DialogFooter>
    </>
  );
}
