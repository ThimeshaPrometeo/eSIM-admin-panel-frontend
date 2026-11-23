"use client";

import { useId, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { useAction } from "@/hooks/use-action";
import { usePermission } from "@/hooks/use-permission";
import { peopleApi } from "@/lib/api/people";
import { formatMoney, formatPerGb } from "@/lib/platform/money";
import type { Reseller } from "@/lib/platform/types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Create a reseller (spec 8.15): company, contact, first user, markup (admin
 * only; staff get the default). Created only in our platform; the first user
 * sets their password at first sign-in.
 */
export function CreateResellerForm({ defaultMarkup = 25, onDone }: { defaultMarkup?: number; onDone: (r?: Reseller) => void }) {
  const id = useId();
  const { me, rules } = usePermission();
  const admin = rules.canChangeMarkup(me);
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [markup, setMarkup] = useState(String(defaultMarkup));
  const { run, pending } = useAction();
  const valid = company.trim().length >= 2 && contact.trim().length >= 2 && EMAIL.test(email) && /^[a-z0-9._-]{3,32}$/i.test(username) && (!admin || Number(markup) >= 0);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create reseller</DialogTitle>
        <DialogDescription>The reseller exists only in this platform; nothing is created at the supplier. Their first user signs in and sets a password.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-co`} label="Company">
          <Input id={`${id}-co`} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Ceylon Explorer Tours" />
        </Field>
        <Field id={`${id}-ct`} label="Contact name">
          <Input id={`${id}-ct`} value={contact} onChange={(e) => setContact(e.target.value)} />
        </Field>
        <Field id={`${id}-em`} label="Email" error={email && !EMAIL.test(email) ? "Enter a valid email address." : undefined}>
          <Input id={`${id}-em`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field id={`${id}-ph`} label="Phone">
          <Input id={`${id}-ph`} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+94 7x xxx xxxx" />
        </Field>
        <Field id={`${id}-un`} label="Username for their first user" hint="3–32 letters, numbers, dots, dashes or underscores.">
          <Input id={`${id}-un`} value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} autoCapitalize="none" spellCheck={false} />
        </Field>
        {admin ? (
          <Field id={`${id}-mk`} label="Markup (%)" hint={`Default for new resellers: ${defaultMarkup}%. Never shown to the reseller.`}>
            <Input id={`${id}-mk`} inputMode="decimal" value={markup} onChange={(e) => setMarkup(e.target.value.replace(/[^\d.]/g, ""))} />
          </Field>
        ) : (
          <p className="self-end text-small text-fg-3">The markup starts at the default ({defaultMarkup}%). Only an administrator can change it.</p>
        )}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button
          disabled={!valid || pending}
          onClick={async () => {
            const r = await run(() => peopleApi.createReseller({ companyName: company, contactName: contact, email, phone, username, markupPercent: admin ? Number(markup) : null }), {
              success: (x) => `${x.companyName} created`,
              description: `Their first user, ${username}, sets a password at first sign-in.`,
            });
            if (r.ok) onDone(r.result);
          }}
        >
          Create reseller
        </Button>
      </DialogFooter>
    </>
  );
}

export function EditResellerForm({ reseller, onDone }: { reseller: Reseller; onDone: () => void }) {
  const id = useId();
  const [company, setCompany] = useState(reseller.companyName);
  const [contact, setContact] = useState(reseller.contactName);
  const [email, setEmail] = useState(reseller.email);
  const [phone, setPhone] = useState(reseller.phone);
  const { run, pending } = useAction();
  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit {reseller.companyName}</DialogTitle>
        <DialogDescription>Company and contact details.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-co`} label="Company">
          <Input id={`${id}-co`} value={company} onChange={(e) => setCompany(e.target.value)} />
        </Field>
        <Field id={`${id}-ct`} label="Contact name">
          <Input id={`${id}-ct`} value={contact} onChange={(e) => setContact(e.target.value)} />
        </Field>
        <Field id={`${id}-em`} label="Email">
          <Input id={`${id}-em`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field id={`${id}-ph`} label="Phone">
          <Input id={`${id}-ph`} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={pending || company.trim().length < 2 || !EMAIL.test(email)}
          onClick={async () => {
            const r = await run(() => peopleApi.updateReseller(reseller.id, { companyName: company, contactName: contact, email, phone }), { success: "Reseller saved" });
            if (r.ok) onDone();
          }}
        >
          Save reseller
        </Button>
      </DialogFooter>
    </>
  );
}

/** Change markup (admin only, audit-logged, applies to usage rated from now; D76). */
export function MarkupForm({ reseller, onDone }: { reseller: Reseller; onDone: () => void }) {
  const id = useId();
  const [markup, setMarkup] = useState(String(reseller.markupPercent ?? ""));
  const [reason, setReason] = useState("");
  const { run, pending } = useAction();
  const next = Number(markup);
  const sample = 0.002; // a typical European network, €/MB
  const changed = markup !== "" && next !== reseller.markupPercent && next >= 0 && next <= 500;
  return (
    <>
      <DialogHeader>
        <DialogTitle>Change markup</DialogTitle>
        <DialogDescription>
          {reseller.companyName} pays the supplier price plus this markup, less any discount. The change applies to usage from the moment you save, including plans already running. The reseller never sees it.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-mk`} label="New markup (%)">
          <Input id={`${id}-mk`} inputMode="decimal" value={markup} onChange={(e) => setMarkup(e.target.value.replace(/[^\d.]/g, ""))} />
        </Field>
        <div className="rounded-control border border-border bg-surface-2/60 p-3">
          <p className="text-small text-fg-3">On a network costing {formatPerGb(sample)}/GB</p>
          <p className="mt-1 flex items-center gap-2 text-body font-semibold tabular">
            <span className="text-fg-2">{formatPerGb(sample * (1 + (reseller.markupPercent ?? 0) / 100))}</span>
            <ArrowRight className="size-4 text-fg-3" strokeWidth={1.5} />
            <span>{changed ? formatPerGb(sample * (1 + next / 100)) : "—"}</span>
          </p>
          <p className="text-small text-fg-3">Before discount</p>
        </div>
        <Field id={`${id}-rs`} label="Reason (kept in the audit log)">
          <Textarea id={`${id}-rs`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. New volume agreement" />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!changed || reason.trim().length < 3 || pending}
          onClick={async () => {
            const r = await run(() => peopleApi.setResellerMarkup(reseller.id, { markupPercent: next, reason }), { success: "Markup changed", description: `${reseller.markupPercent}% → ${next}%, from now on.` });
            if (r.ok) onDone();
          }}
        >
          Change markup
        </Button>
      </DialogFooter>
    </>
  );
}

/** Admin credit or debit to a reseller wallet. A credit pays any outstanding amount, then funds waiting plans. */
export function WalletCreditForm({ reseller, onDone }: { reseller: Reseller; onDone: () => void }) {
  const id = useId();
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const { run, pending } = useAction();
  const n = Number(amount);
  return (
    <>
      <DialogHeader>
        <DialogTitle>Top up wallet</DialogTitle>
        <DialogDescription>
          Available now {formatMoney(reseller.wallet.available)}
          {Number(reseller.wallet.outstanding) > 0 ? `; outstanding ${formatMoney(reseller.wallet.outstanding)} is paid first` : ""}
          {reseller.wallet.waitingPlans ? `; ${reseller.wallet.waitingPlans} plan${reseller.wallet.waitingPlans > 1 ? "s" : ""} waiting for funds are funded oldest first` : ""}.
        </DialogDescription>
      </DialogHeader>
      <div role="radiogroup" aria-label="Direction" className="mb-4 inline-flex rounded-full border border-border p-1">
        {(["credit", "debit"] as const).map((d) => (
          <button key={d} role="radio" aria-checked={direction === d} onClick={() => setDirection(d)} className={`h-8 rounded-full px-4 text-small font-medium ${direction === d ? "bg-surface-3 text-fg" : "text-fg-2"}`}>
            {d === "credit" ? "Credit" : "Debit (adjustment)"}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-am`} label="Amount (EUR)">
          <Input id={`${id}-am`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="250.00" />
        </Field>
        <Field id={`${id}-ds`} label="Description (kept in the audit log)">
          <Input id={`${id}-ds`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Bank transfer BT40221873" />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!(n > 0) || description.trim().length < 3 || pending}
          onClick={async () => {
            const r = await run(() => peopleApi.adjustResellerWallet(reseller.id, { direction, amount: n, description }), {
              success: direction === "credit" ? "Wallet topped up" : "Wallet adjusted",
              description: (e) =>
                [Number(e.outstandingPaid) > 0 ? `${formatMoney(e.outstandingPaid)} paid the outstanding amount.` : "", e.plansFunded ? `${e.plansFunded} waiting plan${e.plansFunded > 1 ? "s" : ""} funded.` : ""].filter(Boolean).join(" ") || undefined,
            });
            if (r.ok) onDone();
          }}
        >
          {direction === "credit" ? "Top up wallet" : "Debit wallet"}
        </Button>
      </DialogFooter>
    </>
  );
}
