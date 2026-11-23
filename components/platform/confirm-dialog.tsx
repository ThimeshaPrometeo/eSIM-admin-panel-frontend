"use client";

import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

/**
 * Confirmation for destructive and money actions. Optional type-to-confirm
 * (e.g. the eSIM's ICCID for end of life) and optional required reason
 * (stored in the audit log). The confirm button uses the action's verb.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  typeToConfirm,
  requireReason,
  warning,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  typeToConfirm?: { value: string; label: string };
  requireReason?: boolean;
  warning?: ReactNode;
  onConfirm: (input: { reason?: string }) => Promise<void> | void;
}) {
  const id = useId();
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const ready =
    (!typeToConfirm || typed.trim() === typeToConfirm.value) && (!requireReason || reason.trim().length >= 3);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setTyped("");
          setReason("");
        }
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {warning ? (
            <div className="rounded-control border border-[color-mix(in_oklab,var(--danger)_35%,transparent)] bg-[color-mix(in_oklab,var(--danger)_8%,transparent)] px-4 py-3 text-body text-fg">
              {warning}
            </div>
          ) : null}
          {requireReason ? (
            <Field id={`${id}-reason`} label="Reason" hint="Saved in the audit log.">
              <Textarea id={`${id}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you doing this?" />
            </Field>
          ) : null}
          {typeToConfirm ? (
            <Field id={`${id}-type`} label={typeToConfirm.label}>
              <Input
                id={`${id}-type`}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="font-mono"
                autoComplete="off"
                spellCheck={false}
                placeholder={typeToConfirm.value}
              />
            </Field>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "primary"}
            disabled={!ready || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm({ reason: requireReason ? reason.trim() : undefined });
                onOpenChange(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Shorthand for actions that only need a reason (block plan, reset 2FA, reject top-up). */
export function ReasonDialog(props: Omit<Parameters<typeof ConfirmDialog>[0], "requireReason" | "typeToConfirm">) {
  return <ConfirmDialog {...props} requireReason />;
}
