"use client";

import { useId, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlatform } from "@/contexts/platform-context";
import { useResource } from "@/hooks/use-resource";
import { accountsApi } from "@/lib/api/accounts";
import { errorMessage } from "@/lib/api/errors";
import { downloadRecoveryCodes, groupSecret } from "@/lib/platform/two-factor";
import { CopyButton } from "./fields";

/** Recovery codes, shown once, with download and copy; "Done" only after the user says they saved them. */
function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const { me } = usePlatform();
  const [saved, setSaved] = useState(false);
  return (
    <>
      <DialogHeader>
        <DialogTitle>Save your recovery codes</DialogTitle>
        <DialogDescription>Each code signs you in once if you lose your phone. They&apos;re shown only now; older codes no longer work.</DialogDescription>
      </DialogHeader>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-control border border-border px-4 py-3 font-mono text-body" aria-label="Recovery codes">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => downloadRecoveryCodes(codes, me?.username ?? "account")}>
          <Download strokeWidth={1.5} />
          Download
        </Button>
        <CopyButton value={codes.join("\n")} label="Copy codes" />
      </div>
      <label className="flex items-center gap-2 text-body">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="size-4 accent-[var(--primary)]" />
        I&apos;ve saved these codes somewhere safe
      </label>
      <DialogFooter>
        <Button disabled={!saved} onClick={onDone}>
          Done
        </Button>
      </DialogFooter>
    </>
  );
}

/** Set up (or move to a new phone) an authenticator app: QR code and key, confirm with a code, then recovery codes. */
export function TotpSetupDialog({ open, onOpenChange, replacing }: { open: boolean; onOpenChange: (o: boolean) => void; replacing: boolean }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">{open ? <TotpSetupBody replacing={replacing} onDone={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  );
}

function TotpSetupBody({ replacing, onDone }: { replacing: boolean; onDone: () => void }) {
  const id = useId();
  const { reloadMe, refresh } = usePlatform();
  const setup = useResource(() => accountsApi.startTotpSetup(), ["totp-setup-dialog"]);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (codes)
    return (
      <RecoveryCodes
        codes={codes}
        onDone={async () => {
          await reloadMe();
          refresh();
          onDone();
        }}
      />
    );
  return (
    <>
      <DialogHeader>
        <DialogTitle>{replacing ? "Move to a new authenticator app" : "Set up an authenticator app"}</DialogTitle>
        <DialogDescription>
          {replacing ? "Your current app keeps working until you confirm a code from the new one." : "You'll enter a code from the app each time you sign in."}
        </DialogDescription>
      </DialogHeader>
      <div className="flex items-start gap-4">
        <div className="grid size-[148px] shrink-0 place-items-center rounded-control bg-white p-2">
          {setup.data ? <QRCodeSVG value={setup.data.otpauthUri} size={132} level="M" title="QR code for your authenticator app" /> : <Skeleton className="size-full" />}
        </div>
        <div className="flex min-w-0 flex-col gap-2 text-body text-fg-2">
          <p>1. Scan the QR code with your authenticator app.</p>
          <p className="text-small">Can&apos;t scan? Type this key:</p>
          <p className="break-all font-mono text-small text-fg">{setup.data ? groupSecret(setup.data.secret) : "…"}</p>
          {setup.data ? <CopyButton value={setup.data.secret} label="Copy key" className="self-start" /> : null}
        </div>
      </div>
      <Field id={`${id}-code`} label="2. Enter the 6-digit code it shows" error={error ?? undefined}>
        <Input
          id={`${id}-code`}
          autoComplete="one-time-code"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          className="font-mono tracking-[0.4em]"
        />
      </Field>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!/^\d{6}$/.test(code) || !setup.data || busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              setCodes((await accountsApi.confirmTotp(code)).recoveryCodes);
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Confirm
        </Button>
      </DialogFooter>
    </>
  );
}

/** New recovery codes: confirm with a code from the app; the old codes stop working. */
export function RecoveryCodesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">{open ? <RegenerateBody onDone={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  );
}

function RegenerateBody({ onDone }: { onDone: () => void }) {
  const id = useId();
  const { refresh } = usePlatform();
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (codes)
    return (
      <RecoveryCodes
        codes={codes}
        onDone={() => {
          refresh();
          onDone();
        }}
      />
    );
  return (
    <>
      <DialogHeader>
        <DialogTitle>Make new recovery codes</DialogTitle>
        <DialogDescription>Your current recovery codes stop working. Confirm with a code from your authenticator app.</DialogDescription>
      </DialogHeader>
      <Field id={`${id}-code`} label="6-digit code" error={error ?? undefined}>
        <Input id={`${id}-code`} autoComplete="one-time-code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" className="font-mono tracking-[0.4em]" />
      </Field>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!/^\d{6}$/.test(code) || busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              setCodes((await accountsApi.regenerateRecoveryCodes(code)).recoveryCodes);
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Make new codes
        </Button>
      </DialogFooter>
    </>
  );
}
