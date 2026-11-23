"use client";

import { FitPage } from "@/components/platform/fit-page";
import { useId, useState } from "react";
import { Plus, ShieldCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/platform/confirm-dialog";
import { DataTable, type Column } from "@/components/platform/data-table";
import { ResellerSelect } from "@/components/platform/fields";
import { PermissionMatrix } from "@/components/platform/permission-matrix";
import { PageHeader } from "@/components/platform/primitives";
import { StatusChip } from "@/components/platform/status-chip";
import { useAction } from "@/hooks/use-action";
import { usePermission } from "@/hooks/use-permission";
import { useResource } from "@/hooks/use-resource";
import { peopleApi } from "@/lib/api/people";
import { formatRelative } from "@/lib/platform/dates";
import { enabledCount, RESELLER_MATRIX, type Grants } from "@/lib/platform/permission-matrix";
import { USER_STATUS } from "@/lib/platform/status-labels";
import type { Assistant } from "@/lib/platform/types";

/**
 * Assistants (spec 8.17). Resellers manage their own team with the
 * permission matrix; admins see every reseller's assistants read-only, with
 * an emergency Disable (reason, audit-logged).
 */
export function AssistantsClient() {
  const { me, rules } = usePermission();
  const team = rules.canManageTeam(me);
  const [resellerId, setResellerId] = useState<string | null>(null);
  const { data, loading, error } = useResource(() => peopleApi.listAssistants({ resellerId }), [resellerId]);
  const ctx = useResource(() => peopleApi.getPermissionContext(), ["perm-ctx"]);
  const [editing, setEditing] = useState<Assistant | null>(null);
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState<Assistant | null>(null);
  const { run } = useAction();
  const canDisableAny = rules.canDisableAnyAssistant(me);

  const columns: Column<Assistant>[] = [
    {
      id: "name",
      header: "Name",
      cell: (a) => (
        <span className="flex flex-col">
          <span className="font-medium">{a.fullName}</span>
          <span className="text-small text-fg-3">
            {a.username} · {a.email}
          </span>
        </span>
      ),
      sortValue: (a) => a.fullName,
      hideable: false,
    },
    ...(!team ? [{ id: "reseller", header: "Reseller", cell: (a: Assistant) => a.resellerName, sortValue: (a: Assistant) => a.resellerName }] : []),
    { id: "status", header: "Status", cell: (a) => <StatusChip status={USER_STATUS[a.status]} />, sortValue: (a) => a.status },
    {
      id: "access",
      header: "Access",
      cell: (a) => {
        const c = enabledCount(a.grants, RESELLER_MATRIX);
        return (
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-3">
              <span className="block h-full rounded-full bg-[var(--gradient-signature)]" style={{ width: `${(c.enabled / c.total) * 100}%` }} />
            </span>
            <span className="text-small text-fg-2 tabular">
              {c.enabled} of {c.total} areas enabled
            </span>
          </span>
        );
      },
      sortValue: (a) => enabledCount(a.grants, RESELLER_MATRIX).enabled,
    },
    { id: "last", header: "Last sign-in", cell: (a) => <span className="text-fg-2">{a.lastSignInAt ? formatRelative(a.lastSignInAt) : "Never"}</span>, sortValue: (a) => a.lastSignInAt ?? "" },
    {
      id: "actions",
      header: "",
      align: "right",
      hideable: false,
      cell: (a) => (
        <span className="inline-flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(a)}>
            <ShieldCheck strokeWidth={1.5} />
            {team ? "Permissions" : "View access"}
          </Button>
          {team || (canDisableAny && a.status === "active") ? (
            <Button variant="ghost" size="sm" onClick={() => setToggling(a)}>
              <UserX strokeWidth={1.5} />
              {a.status === "active" ? "Disable" : "Enable"}
            </Button>
          ) : null}
        </span>
      ),
    },
  ];

  const envelope = ctx.data?.envelope ?? {};
  return (
    <FitPage>
      <PageHeader
        title={team ? "Assistants" : "Assistants"}
        description={
          team
            ? "People who work in your account. Choose exactly what each one can see and do; they can never have more than you."
            : "Assistants across all resellers. Resellers manage their own team; you can disable one in an emergency."
        }
        actions={
          team ? (
            <Button onClick={() => setCreating(true)}>
              <Plus strokeWidth={1.75} />
              Add assistant
            </Button>
          ) : null
        }
      />
      <DataTable
        rows={data}
        loading={loading}
        error={error}
        columns={columns}
        rowKey={(a) => a.id}
        caption="Assistants"
        toolbar={!team ? <ResellerSelect value={resellerId} onChange={setResellerId} /> : undefined}
        empty={{ title: "No assistants yet", description: team ? "Add someone from your team and choose what they can do." : "No reseller has added an assistant.", action: team ? <Button onClick={() => setCreating(true)}>Add assistant</Button> : undefined }}
      />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">{editing ? <EditPermissions assistant={editing} envelope={envelope} readOnly={!team} onDone={() => setEditing(null)} /> : null}</DialogContent>
      </Dialog>
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">{creating ? <CreateAssistant envelope={envelope} onDone={() => setCreating(false)} /> : null}</DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!toggling}
        onOpenChange={(o) => !o && setToggling(null)}
        title={toggling?.status === "active" ? `Disable ${toggling?.fullName}?` : `Enable ${toggling?.fullName}?`}
        description={toggling?.status === "active" ? "They're signed out at once and can't sign in until enabled again." : "They can sign in again with the access they had."}
        confirmLabel={toggling?.status === "active" ? "Disable assistant" : "Enable assistant"}
        destructive={toggling?.status === "active"}
        requireReason={!team}
        onConfirm={async ({ reason }) => {
          const next = toggling!.status === "active" ? "disabled" : "active";
          const r = await run(() => peopleApi.setAssistantStatus(toggling!.id, { status: next, reason }), { success: next === "disabled" ? "Assistant disabled" : "Assistant enabled" });
          if (r.ok) setToggling(null);
        }}
      />
    </FitPage>
  );
}

function EditPermissions({ assistant, envelope, readOnly, onDone }: { assistant: Assistant; envelope: Grants; readOnly: boolean; onDone: () => void }) {
  const [grants, setGrants] = useState<Grants>(assistant.grants);
  const { run, pending } = useAction();
  const changed = JSON.stringify(grants) !== JSON.stringify(assistant.grants);
  return (
    <>
      <DialogHeader>
        <DialogTitle>{readOnly ? `${assistant.fullName}'s access` : `What ${assistant.fullName} can do`}</DialogTitle>
        <DialogDescription>
          {readOnly ? `Set by ${assistant.resellerName}.` : "Manage turns View on; View off turns Manage off. Areas your account doesn't have are greyed out. Their own profile is always available."}
        </DialogDescription>
      </DialogHeader>
      <PermissionMatrix sections={RESELLER_MATRIX} value={grants} envelope={readOnly ? grants : envelope} onChange={setGrants} readOnly={readOnly} idPrefix={`pm-${assistant.id}`} />
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          {readOnly ? "Close" : "Cancel"}
        </Button>
        {!readOnly ? (
          <Button
            disabled={!changed || pending}
            onClick={async () => {
              const r = await run(() => peopleApi.setAssistantPermissions(assistant.id, grants), { success: "Permissions saved", description: `${assistant.fullName} sees the change at their next page load.` });
              if (r.ok) onDone();
            }}
          >
            Save permissions
          </Button>
        ) : null}
      </DialogFooter>
    </>
  );
}

function CreateAssistant({ envelope, onDone }: { envelope: Grants; onDone: () => void }) {
  const id = useId();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [grants, setGrants] = useState<Grants>({ dashboard: "view", sell_esim: "manage", esims: "view", coverage: "view", price_lists: "view" });
  const { run, pending } = useAction();
  const valid = fullName.trim().length >= 2 && /^[a-z0-9._-]{3,32}$/.test(username) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return (
    <>
      <DialogHeader>
        <DialogTitle>Add assistant</DialogTitle>
        <DialogDescription>They get an email to set their password, and sign in with their own account.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={`${id}-n`} label="Full name">
          <Input id={`${id}-n`} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field id={`${id}-u`} label="Username">
          <Input id={`${id}-u`} value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} autoCapitalize="none" spellCheck={false} />
        </Field>
        <Field id={`${id}-e`} label="Email">
          <Input id={`${id}-e`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
      </div>
      <div className="mt-5">
        <PermissionMatrix sections={RESELLER_MATRIX} value={grants} envelope={envelope} onChange={setGrants} idPrefix="pm-new" />
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!valid || pending}
          onClick={async () => {
            const r = await run(() => peopleApi.createAssistant({ fullName, username, email, grants }), { success: (a) => `${a.fullName} added` });
            if (r.ok) onDone();
          }}
        >
          Add assistant
        </Button>
      </DialogFooter>
    </>
  );
}
