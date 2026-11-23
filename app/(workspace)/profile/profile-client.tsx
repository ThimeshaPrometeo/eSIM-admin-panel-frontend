"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Detail } from "@/components/platform/fields";
import { FitPage, FitScroll } from "@/components/platform/fit-page";
import { GlassCard } from "@/components/platform/glass-card";
import { PageHeader } from "@/components/platform/primitives";
import { usePlatform } from "@/contexts/platform-context";
import { useAction } from "@/hooks/use-action";
import { useResource } from "@/hooks/use-resource";
import { accountsApi } from "@/lib/api/accounts";
import { formatDateTime } from "@/lib/platform/dates";
import type { MySecurity } from "@/lib/platform/types";
import { ProfileTabs } from "./profile-tabs";

const ROLE = { admin: "Administrator", staff: "Staff", reseller: "Reseller", assistant: "Assistant" } as const;

/** Profile (spec 8.30): name and email; username read only; change password. */
export function ProfileClient() {
  const { data } = useResource(() => accountsApi.getMySecurity(), ["my-security"]);
  return (
    <FitPage>
      <PageHeader title="Profile and security" description="Your details and how you sign in." />
      <ProfileTabs />
      <FitScroll>
        <div className="grid gap-4 pb-2 lg:grid-cols-2">{!data ? <Skeleton className="h-80 lg:col-span-2" /> : <Details key={`${data.fullName}|${data.email}`} data={data} />}<PasswordCard /></div>
      </FitScroll>
    </FitPage>
  );
}

function Details({ data }: { data: MySecurity }) {
  const id = useId();
  const { me, reloadMe } = usePlatform();
  const [name, setName] = useState(data.fullName);
  const [email, setEmail] = useState(data.email);
  const { run, pending } = useAction();
  const dirty = name.trim() !== data.fullName || email.trim() !== data.email;
  return (
    <GlassCard className="flex flex-col gap-4">
      <div>
        <h2 className="text-section font-semibold">Your details</h2>
        <p className="text-small text-fg-2">Shown to your team and in the audit log.</p>
      </div>
      <Field id={`${id}-n`} label="Full name">
        <Input id={`${id}-n`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </Field>
      <Field id={`${id}-e`} label="Email" hint="Password reset links go here.">
        <Input id={`${id}-e`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </Field>
      <dl className="grid grid-cols-2 gap-4">
        <Detail label="Username">
          <span className="font-mono text-small">{data.username}</span>
          <span className="block text-small text-fg-3">Only an administrator can change it.</span>
        </Detail>
        <Detail label="Role">
          {me ? ROLE[me.role] : "—"}
          {me?.staffRoleName ? ` · ${me.staffRoleName}` : me?.resellerName ? ` · ${me.resellerName}` : ""}
        </Detail>
        <Detail label="Last sign-in">{data.lastSignInAt ? formatDateTime(data.lastSignInAt) : "—"}</Detail>
      </dl>
      <div className="mt-auto flex justify-end gap-2">
        <Button
          variant="ghost"
          disabled={!dirty || pending}
          onClick={() => {
            setName(data.fullName);
            setEmail(data.email);
          }}
        >
          Discard
        </Button>
        <Button
          disabled={!dirty || pending}
          onClick={async () => {
            const r = await run(() => accountsApi.updateProfile({ fullName: name, email }), { success: "Profile saved" });
            if (r.ok) await reloadMe();
          }}
        >
          Save details
        </Button>
      </div>
    </GlassCard>
  );
}

function PasswordCard() {
  const id = useId();
  const { changePassword } = usePlatform();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const { run, pending } = useAction();
  const mismatch = confirm.length > 0 && confirm !== next;
  const ready = current.length > 0 && next.length >= 10 && next === confirm && next !== current;
  return (
    <GlassCard className="flex flex-col gap-4">
      <div>
        <h2 className="text-section font-semibold">Password</h2>
        <p className="text-small text-fg-2">At least 10 characters. Forgot it? Sign out and use “Forgot password?”.</p>
      </div>
      <Field id={`${id}-c`} label="Current password">
        <Input id={`${id}-c`} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
      </Field>
      <Field id={`${id}-n`} label="New password" error={next.length > 0 && next.length < 10 ? "At least 10 characters." : next && next === current ? "Choose a different password." : undefined}>
        <Input id={`${id}-n`} type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
      </Field>
      <Field id={`${id}-r`} label="Confirm new password" error={mismatch ? "The two passwords don't match." : undefined}>
        <Input id={`${id}-r`} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
      </Field>
      <div className="mt-auto flex justify-end">
        <Button
          disabled={!ready || pending}
          onClick={async () => {
            const r = await run(() => changePassword(current, next), { success: "Password changed" });
            if (r.ok) {
              setCurrent("");
              setNext("");
              setConfirm("");
            }
          }}
        >
          Change password
        </Button>
      </div>
    </GlassCard>
  );
}
