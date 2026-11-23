"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Fingerprint, KeyRound, LogOut, Pencil, Plus, ShieldAlert, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/platform/confirm-dialog";
import { FitPage, FitScroll } from "@/components/platform/fit-page";
import { GlassCard } from "@/components/platform/glass-card";
import { PageHeader } from "@/components/platform/primitives";
import { StatusChip } from "@/components/platform/status-chip";
import { RecoveryCodesDialog, TotpSetupDialog } from "@/components/platform/two-factor-dialogs";
import { usePlatform } from "@/contexts/platform-context";
import { useAction } from "@/hooks/use-action";
import { useResource } from "@/hooks/use-resource";
import { accountsApi } from "@/lib/api/accounts";
import { formatDate, formatRelative } from "@/lib/platform/dates";
import type { MySecurity } from "@/lib/platform/types";
import { ProfileTabs } from "../profile-tabs";

/** Security (spec 8.30): authenticator app and recovery codes, passkeys, sign out everywhere. */
export function SecurityClient() {
  const { data } = useResource(() => accountsApi.getMySecurity(), ["my-security"]);
  return (
    <FitPage>
      <PageHeader title="Profile and security" description="Two-factor authentication is required for every account: an authenticator app, a passkey, or both." />
      <ProfileTabs />
      <FitScroll>{!data ? <Skeleton className="h-80" /> : <Body data={data} />}</FitScroll>
    </FitPage>
  );
}

function Body({ data }: { data: MySecurity }) {
  const router = useRouter();
  const { reloadMe } = usePlatform();
  const { run, pending } = useAction();
  const [dialog, setDialog] = useState<"totp" | "codes" | "passkey" | "everywhere" | null>(null);
  const [renaming, setRenaming] = useState<MySecurity["passkeys"][number] | null>(null);
  const [removing, setRemoving] = useState<MySecurity["passkeys"][number] | null>(null);
  const protectedBy = [data.app.enabled ? "authenticator app" : null, data.passkeys.length ? `${data.passkeys.length} passkey${data.passkeys.length === 1 ? "" : "s"}` : null].filter(Boolean);

  return (
    <div className="flex flex-col gap-4 pb-2">
      {!protectedBy.length ? (
        <p role="status" className="flex items-start gap-3 rounded-card border border-[color-mix(in_oklab,var(--warning)_45%,transparent)] bg-[color-mix(in_oklab,var(--warning)_8%,transparent)] px-4 py-3 text-body">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" strokeWidth={1.5} />
          Your account has no second step yet. Set up an authenticator app or add a passkey; it will be required for every account.
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Smartphone className="size-5 text-primary" strokeWidth={1.5} />
              <div>
                <h2 className="text-section font-semibold">Authenticator app</h2>
                <p className="text-small text-fg-2">A 6-digit code from your phone at every sign-in.</p>
              </div>
            </div>
            <StatusChip status={data.app.enabled ? { label: "On", tone: "positive" } : { label: "Off", tone: "neutral" }} />
          </div>
          {data.app.enabled ? (
            <dl className="grid grid-cols-2 gap-4 text-body">
              <div>
                <dt className="text-small text-fg-3">Set up</dt>
                <dd>{data.app.enabledAt ? formatDate(data.app.enabledAt) : "—"}</dd>
              </div>
              <div>
                <dt className="text-small text-fg-3">Recovery codes left</dt>
                <dd className={data.app.recoveryCodesLeft <= 3 ? "font-medium text-warning tabular" : "tabular"}>
                  {data.app.recoveryCodesLeft} of 10{data.app.recoveryCodesLeft <= 3 ? ": make new ones" : ""}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-body text-fg-2">Scan a QR code with an app such as an authenticator on your phone, then confirm with a code. You&apos;ll get 10 recovery codes for when you lose the phone.</p>
          )}
          <div className="mt-auto flex flex-wrap gap-2">
            <Button variant={data.app.enabled ? "secondary" : "primary"} onClick={() => setDialog("totp")}>
              <ShieldCheck strokeWidth={1.5} />
              {data.app.enabled ? "Move to a new phone" : "Set up authenticator app"}
            </Button>
            {data.app.enabled ? (
              <Button variant="secondary" onClick={() => setDialog("codes")}>
                <KeyRound strokeWidth={1.5} />
                New recovery codes
              </Button>
            ) : null}
          </div>
        </GlassCard>

        <GlassCard className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Fingerprint className="size-5 text-primary" strokeWidth={1.5} />
              <div>
                <h2 className="text-section font-semibold">Passkeys</h2>
                <p className="text-small text-fg-2">Sign in with your fingerprint, face or device PIN, without a password or code.</p>
              </div>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setDialog("passkey")}>
              <Plus strokeWidth={1.5} />
              Add
            </Button>
          </div>
          {data.passkeys.length ? (
            <ul className="flex flex-col divide-y divide-border">
              {data.passkeys.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body font-medium">{p.name}</span>
                    <span className="text-small text-fg-3">
                      Added {formatDate(p.createdAt)} · {p.lastUsedAt ? `last used ${formatRelative(p.lastUsedAt)}` : "not used yet"}
                    </span>
                  </span>
                  <Button size="icon" variant="ghost" aria-label={`Rename ${p.name}`} onClick={() => setRenaming(p)}>
                    <Pencil strokeWidth={1.5} />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label={`Remove ${p.name}`} onClick={() => setRemoving(p)}>
                    <Trash2 strokeWidth={1.5} />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body text-fg-3">No passkeys yet.</p>
          )}
        </GlassCard>

        <GlassCard className="flex flex-col gap-3 lg:col-span-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <LogOut className="size-5 text-primary" strokeWidth={1.5} />
            <div>
              <h2 className="text-section font-semibold">Sessions</h2>
              <p className="text-small text-fg-2">Lost a device, or signed in on a shared computer? Sign out everywhere, including here.</p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => setDialog("everywhere")}>
            Sign out everywhere
          </Button>
        </GlassCard>
      </div>

      <TotpSetupDialog open={dialog === "totp"} onOpenChange={(o) => !o && setDialog(null)} replacing={data.app.enabled} />
      <RecoveryCodesDialog open={dialog === "codes"} onOpenChange={(o) => !o && setDialog(null)} />
      <PasskeyNameDialog
        open={dialog === "passkey" || !!renaming}
        initial={renaming?.name ?? ""}
        title={renaming ? "Rename passkey" : "Add a passkey"}
        onOpenChange={(o) => {
          if (!o) {
            setDialog(null);
            setRenaming(null);
          }
        }}
        onSave={async (name) => {
          const r = renaming ? await run(() => accountsApi.renamePasskey(renaming.id, name), { success: "Passkey renamed" }) : await run(() => accountsApi.addPasskey(name), { success: "Passkey added" });
          if (r.ok) {
            setDialog(null);
            setRenaming(null);
            await reloadMe();
          }
        }}
        busy={pending}
        adding={!renaming}
      />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove “${removing?.name ?? ""}”?`}
        description="You won't be able to sign in with it any more. You can add it again later."
        confirmLabel="Remove passkey"
        destructive
        onConfirm={async () => {
          const r = await run(() => accountsApi.removePasskey(removing!.id), { success: "Passkey removed" });
          if (r.ok) {
            setRemoving(null);
            await reloadMe();
          }
        }}
      />
      <ConfirmDialog
        open={dialog === "everywhere"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Sign out everywhere?"
        description="Every browser and device signed in to your account is signed out, including this one. You'll sign in again with your password and second step."
        confirmLabel="Sign out everywhere"
        destructive
        onConfirm={async () => {
          const r = await run(() => accountsApi.signOutEverywhere(), { success: "Signed out everywhere" });
          if (r.ok) {
            await reloadMe();
            router.replace("/");
          }
        }}
      />
    </div>
  );
}

function PasskeyNameDialog({
  open,
  onOpenChange,
  onSave,
  initial,
  title,
  busy,
  adding,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (name: string) => void;
  initial: string;
  title: string;
  busy: boolean;
  adding: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">{open ? <PasskeyNameForm key={initial} initial={initial} title={title} busy={busy} adding={adding} onSave={onSave} onCancel={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  );
}

function PasskeyNameForm({ initial, title, busy, adding, onSave, onCancel }: { initial: string; title: string; busy: boolean; adding: boolean; onSave: (name: string) => void; onCancel: () => void }) {
  const id = useId();
  const { isDemo } = usePlatform();
  const [name, setName] = useState(initial);
  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          {adding ? `A name helps you tell your devices apart.${isDemo ? " Demo: the browser's passkey prompt is skipped." : " Your browser asks you to confirm with your fingerprint, face or PIN."}` : "A name helps you tell your devices apart."}
        </DialogDescription>
      </DialogHeader>
      <Field id={`${id}-n`} label="Name">
        <Input id={`${id}-n`} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Work laptop" maxLength={40} autoFocus />
      </Field>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={!name.trim() || busy} onClick={() => onSave(name.trim())}>
          {adding ? "Add passkey" : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}
