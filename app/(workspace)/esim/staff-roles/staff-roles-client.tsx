"use client";

import { useId, useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/platform/confirm-dialog";
import { FitPage, FitScroll } from "@/components/platform/fit-page";
import { GlassCard } from "@/components/platform/glass-card";
import { PermissionMatrix } from "@/components/platform/permission-matrix";
import { PageHeader } from "@/components/platform/primitives";
import { useAction } from "@/hooks/use-action";
import { usePermission } from "@/hooks/use-permission";
import { useResource } from "@/hooks/use-resource";
import { accountsApi } from "@/lib/api/accounts";
import { enabledCount, STAFF_MATRIX, type Grants } from "@/lib/platform/permission-matrix";
import { ROLE_ENVELOPES } from "@/lib/platform/permissions";
import type { StaffRole } from "@/lib/platform/types";
import { cn } from "@/lib/utils";

/** Staff roles (spec 8.25): admins create and edit; the staff envelope limits what a role can grant. */
export function StaffRolesClient() {
  const { can } = usePermission();
  const manage = can("staff_roles", "manage");
  const { data } = useResource(() => accountsApi.listStaffRoles(), ["staff-roles"]);
  const [picked, setPicked] = useState<string | "new" | null>(null);
  const current = picked === "new" ? null : (data?.find((r) => r.id === picked) ?? data?.[0] ?? null);
  return (
    <FitPage>
      <PageHeader
        title="Staff roles"
        description={manage ? "What each group of staff can see and do. Changes apply to everyone in the role." : "What each group of staff can see and do. Only an administrator can change roles."}
        actions={
          manage ? (
            <Button onClick={() => setPicked("new")}>
              <Plus strokeWidth={1.5} />
              New role
            </Button>
          ) : null
        }
      />
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <GlassCard className="flex flex-col gap-1 self-start !p-3">
          {!data ? (
            <Skeleton className="h-32" />
          ) : (
            data.map((r) => (
              <button
                key={r.id}
                onClick={() => setPicked(r.id)}
                className={cn("flex flex-col rounded-control px-3 py-2 text-left transition-colors", picked !== "new" && current?.id === r.id ? "bg-surface-3" : "hover:bg-surface-3/50")}
              >
                <span className="text-body font-medium">{r.name}</span>
                <span className="text-small text-fg-3">
                  {r.members.length} member{r.members.length === 1 ? "" : "s"} · {enabledCount(r.grants, STAFF_MATRIX).enabled} areas
                </span>
              </button>
            ))
          )}
          {picked === "new" ? <span className="rounded-control bg-surface-3 px-3 py-2 text-body font-medium">New role</span> : null}
        </GlassCard>
        {data && (current || picked === "new") ? <Editor key={current?.id ?? "new"} role={current} readOnly={!manage} onSaved={(id) => setPicked(id)} onDeleted={() => setPicked(null)} /> : null}
      </div>
    </FitPage>
  );
}

function Editor({ role, readOnly, onSaved, onDeleted }: { role: StaffRole | null; readOnly: boolean; onSaved: (id: string) => void; onDeleted: () => void }) {
  const id = useId();
  const [name, setName] = useState(role?.name ?? "");
  const [grants, setGrants] = useState<Grants>(role?.grants ?? { dashboard: "view" });
  const [removing, setRemoving] = useState(false);
  const { run, pending } = useAction();
  const dirty = !role || name.trim() !== role.name || JSON.stringify(grants) !== JSON.stringify(role.grants);
  return (
    <FitScroll className="lg:!mx-0 lg:!px-0">
      <div className="flex flex-col gap-4 pb-2">
        <GlassCard className="flex flex-wrap items-end gap-4">
          <Field id={`${id}-n`} label="Role name">
            <Input id={`${id}-n`} value={name} onChange={(e) => setName(e.target.value)} readOnly={readOnly} placeholder="e.g. Support" className="sm:w-64" />
          </Field>
          <span className="flex items-center gap-2 pb-2 text-small text-fg-2">
            <Users className="size-4" strokeWidth={1.5} />
            {role?.members.length ? role.members.map((m) => m.fullName).join(", ") : "No members yet"}
          </span>
          {!readOnly ? (
            <span className="ml-auto flex gap-2">
              {role ? (
                <Button variant="ghost" onClick={() => setRemoving(true)} disabled={pending}>
                  <Trash2 strokeWidth={1.5} />
                  Delete
                </Button>
              ) : null}
              <Button
                disabled={!dirty || name.trim().length < 2 || pending}
                onClick={async () => {
                  const r = await run(() => accountsApi.saveStaffRole(role?.id ?? null, { name, grants }), { success: role ? "Role saved" : "Role created" });
                  if (r.ok) onSaved(r.result.id);
                }}
              >
                {role ? "Save role" : "Create role"}
              </Button>
            </span>
          ) : null}
        </GlassCard>
        <PermissionMatrix
          sections={STAFF_MATRIX}
          value={grants}
          envelope={ROLE_ENVELOPES.staff}
          onChange={setGrants}
          readOnly={readOnly}
          envelopeReason="Staff can't have this; it's for administrators only."
          idPrefix="staff"
        />
      </div>
      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title={`Delete the ${role?.name ?? ""} role?`}
        description={role?.members.length ? "Move its members to another role first (Users → Change staff role)." : "Nobody has this role. It can't be undone."}
        confirmLabel="Delete role"
        destructive
        onConfirm={async () => {
          const r = await run(() => accountsApi.deleteStaffRole(role!.id), { success: "Role deleted" });
          setRemoving(false);
          if (r.ok) onDeleted();
        }}
      />
    </FitScroll>
  );
}
