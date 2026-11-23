"use client";

import { useId, useState } from "react";
import { Fingerprint, KeyRound, Lock, MoreHorizontal, Plus, ShieldOff, Smartphone, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/platform/confirm-dialog";
import { DataTable, type Column } from "@/components/platform/data-table";
import { CopyButton, FilterSelect, SearchInput } from "@/components/platform/fields";
import { FitPage } from "@/components/platform/fit-page";
import { PageHeader } from "@/components/platform/primitives";
import { StatusChip } from "@/components/platform/status-chip";
import { useAction } from "@/hooks/use-action";
import { usePermission } from "@/hooks/use-permission";
import { useResource } from "@/hooks/use-resource";
import { accountsApi, type UserFilters } from "@/lib/api/accounts";
import { formatDateTime, formatRelative } from "@/lib/platform/dates";
import type { Role, UserAccount } from "@/lib/platform/types";

const ROLE: Record<Role, string> = { admin: "Administrator", staff: "Staff", reseller: "Reseller", assistant: "Assistant" };
type Act = { kind: "status" | "unlock" | "mfa" | "username" | "role"; user: UserAccount } | null;

/** Users (spec 8.24): every account; admin and staff manage, admins alone change usernames and staff roles. */
export function UsersClient() {
  const { me, can } = usePermission();
  const manage = can("users", "manage");
  const admin = me?.role === "admin";
  const [q, setQ] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [state, setState] = useState<UserFilters["state"]>(null);
  const [adding, setAdding] = useState(false);
  const [act, setAct] = useState<Act>(null);
  const { data, loading, error } = useResource(() => accountsApi.listUsers({ q, role, state }), [q, role, state]);
  const { run } = useAction();

  const columns: Column<UserAccount>[] = [
    {
      id: "name",
      header: "Name",
      hideable: false,
      cell: (u) => (
        <span className="flex flex-col">
          <span className="font-medium">
            {u.fullName}
            {u.id === me?.id ? <span className="ml-1.5 text-small font-normal text-fg-3">(you)</span> : null}
          </span>
          <span className="font-mono text-small text-fg-3">{u.username}</span>
        </span>
      ),
      sortValue: (u) => u.fullName,
    },
    { id: "email", header: "Email", defaultHidden: true, cell: (u) => <span className="text-fg-2">{u.email}</span>, sortValue: (u) => u.email },
    {
      id: "role",
      header: "Role",
      cell: (u) => (
        <span className="flex flex-col">
          <span>{ROLE[u.role]}</span>
          <span className="text-small text-fg-3">{u.staffRoleName ?? u.resellerName ?? ""}</span>
        </span>
      ),
      sortValue: (u) => `${u.role}${u.staffRoleName ?? u.resellerName ?? ""}`,
    },
    {
      id: "status",
      header: "Status",
      cell: (u) => (
        <span className="flex flex-col items-start gap-1">
          <StatusChip status={u.status === "disabled" ? { label: "Disabled", tone: "neutral" } : u.locked ? { label: "Locked", tone: "danger" } : { label: "Active", tone: "positive" }} />
          {u.locked && u.lockedUntil ? <span className="text-small text-fg-3">until {formatDateTime(u.lockedUntil).split(", ").pop()}</span> : u.mustChangePassword ? <span className="text-small text-fg-3">First sign-in pending</span> : null}
        </span>
      ),
      sortValue: (u) => (u.status === "disabled" ? 2 : u.locked ? 0 : 1),
    },
    {
      id: "mfa",
      header: "Two-factor",
      cell: (u) =>
        u.mfaApp || u.passkeys ? (
          <span className="flex items-center gap-3 text-fg-2">
            {u.mfaApp ? (
              <span className="inline-flex items-center gap-1" title="Authenticator app">
                <Smartphone className="size-4 text-accent" strokeWidth={1.5} />
                App
              </span>
            ) : null}
            {u.passkeys ? (
              <span className="inline-flex items-center gap-1" title="Passkeys">
                <Fingerprint className="size-4 text-accent" strokeWidth={1.5} />
                {u.passkeys}
              </span>
            ) : null}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-warning">
            <ShieldOff className="size-4" strokeWidth={1.5} />
            Not set up
          </span>
        ),
      sortValue: (u) => (u.mfaApp ? 2 : 0) + (u.passkeys ? 1 : 0),
    },
    { id: "last", header: "Last sign-in", cell: (u) => <span className="text-fg-2" title={u.lastSignInAt ? formatDateTime(u.lastSignInAt) : undefined}>{u.lastSignInAt ? formatRelative(u.lastSignInAt) : "Never"}</span>, sortValue: (u) => u.lastSignInAt ?? "" },
    ...(manage
      ? [
          {
            id: "actions",
            header: "",
            hideable: false,
            align: "right" as const,
            cell: (u: UserAccount) => {
              const locked = u.role === "admin" && !admin; // staff can't change admin accounts
              if (locked) return null;
              return (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" aria-label={`Actions for ${u.fullName}`} onClick={(e) => e.stopPropagation()}>
                      <MoreHorizontal strokeWidth={1.5} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {u.locked ? (
                      <DropdownMenuItem onSelect={() => setAct({ kind: "unlock", user: u })}>
                        <Lock strokeWidth={1.5} />
                        Unlock
                      </DropdownMenuItem>
                    ) : null}
                    {u.id !== me?.id ? (
                      <DropdownMenuItem onSelect={() => setAct({ kind: "mfa", user: u })} disabled={!u.mfaApp && !u.passkeys}>
                        <KeyRound strokeWidth={1.5} />
                        Reset two-factor
                      </DropdownMenuItem>
                    ) : null}
                    {admin ? (
                      <DropdownMenuItem onSelect={() => setAct({ kind: "username", user: u })}>
                        <UserCog strokeWidth={1.5} />
                        Change username
                      </DropdownMenuItem>
                    ) : null}
                    {admin && u.role === "staff" ? (
                      <DropdownMenuItem onSelect={() => setAct({ kind: "role", user: u })}>
                        <UserCog strokeWidth={1.5} />
                        Change staff role
                      </DropdownMenuItem>
                    ) : null}
                    {u.id !== me?.id ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem destructive={u.status === "active"} onSelect={() => setAct({ kind: "status", user: u })}>
                          {u.status === "active" ? "Disable account" : "Enable account"}
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            },
          },
        ]
      : []),
  ];

  const u = act?.user;
  return (
    <FitPage>
      <PageHeader
        title="Users"
        description="Every account: our team, resellers and their assistants. Resellers manage their own assistants."
        actions={
          manage ? (
            <Button onClick={() => setAdding(true)}>
              <Plus strokeWidth={1.5} />
              Add staff user
            </Button>
          ) : null
        }
      />
      <DataTable
        rows={data}
        loading={loading}
        error={error}
        columns={columns}
        rowKey={(x) => x.id}
        defaultSort={{ id: "name" }}
        caption="Users"
        toolbar={
          <>
            <SearchInput value={q} onChange={setQ} placeholder="Search name, username or email" />
            <FilterSelect label="Role" value={role} onChange={setRole} all="Any role" options={(Object.keys(ROLE) as Role[]).map((r) => ({ value: r, label: ROLE[r] }))} className="sm:w-40" />
            <FilterSelect
              label="State"
              value={state ?? null}
              onChange={setState}
              all="Any state"
              options={[
                { value: "active", label: "Active" },
                { value: "locked", label: "Locked" },
                { value: "disabled", label: "Disabled" },
                { value: "no_app", label: "No authenticator app" },
              ]}
              className="sm:w-52"
            />
          </>
        }
        empty={{ title: "No users match", description: "Try another search or filter." }}
      />

      <AddStaffDialog open={adding} onOpenChange={setAdding} />
      <ConfirmDialog
        open={act?.kind === "unlock"}
        onOpenChange={(o) => !o && setAct(null)}
        title={`Unlock ${u?.fullName ?? ""}?`}
        description="They can sign in again straight away. Locks after 10 failed attempts also end by themselves after 15 minutes."
        confirmLabel="Unlock"
        onConfirm={async () => {
          const r = await run(() => accountsApi.unlockUser(u!.id), { success: "Account unlocked" });
          if (r.ok) setAct(null);
        }}
      />
      <ConfirmDialog
        open={act?.kind === "mfa"}
        onOpenChange={(o) => !o && setAct(null)}
        title={`Reset two-factor for ${u?.fullName ?? ""}?`}
        description="Removes their authenticator app, recovery codes and passkeys. They set two-factor up again at their next sign-in. Use this when they've lost their phone."
        confirmLabel="Reset two-factor"
        destructive
        requireReason
        onConfirm={async ({ reason }) => {
          const r = await run(() => accountsApi.resetUserMfa(u!.id, reason ?? ""), { success: "Two-factor reset", description: "They'll set it up at next sign-in." });
          if (r.ok) setAct(null);
        }}
      />
      <ConfirmDialog
        open={act?.kind === "status"}
        onOpenChange={(o) => !o && setAct(null)}
        title={u?.status === "active" ? `Disable ${u?.fullName ?? ""}?` : `Enable ${u?.fullName ?? ""}?`}
        description={u?.status === "active" ? "They can't sign in until the account is enabled again. Nothing they did is removed." : "They can sign in again with their password and two-factor."}
        confirmLabel={u?.status === "active" ? "Disable account" : "Enable account"}
        destructive={u?.status === "active"}
        requireReason={u?.status === "active"}
        onConfirm={async ({ reason }) => {
          const next = u!.status === "active" ? "disabled" : "active";
          const r = await run(() => accountsApi.setUserStatus(u!.id, next, reason ?? ""), { success: next === "disabled" ? "Account disabled" : "Account enabled" });
          if (r.ok) setAct(null);
        }}
      />
      <UsernameDialog user={act?.kind === "username" ? u! : null} onClose={() => setAct(null)} />
      <StaffRoleDialog user={act?.kind === "role" ? u! : null} onClose={() => setAct(null)} />
    </FitPage>
  );
}

function AddStaffDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">{open ? <AddStaffForm onDone={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  );
}

function AddStaffForm({ onDone }: { onDone: () => void }) {
  const id = useId();
  const roles = useResource(() => accountsApi.listStaffRoles(), ["staff-roles"]);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [created, setCreated] = useState<{ user: UserAccount; temporaryPassword: string } | null>(null);
  const { run, pending } = useAction();
  if (created)
    return (
      <>
        <DialogHeader>
          <DialogTitle>{created.user.fullName} can sign in</DialogTitle>
          <DialogDescription>Give them this temporary password in person or by phone. It&apos;s shown only now; they choose their own and set up two-factor at first sign-in.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-3 rounded-control border border-border px-4 py-3">
          <span className="flex flex-col">
            <span className="text-small text-fg-3">Username {created.user.username}</span>
            <span className="font-mono text-section">{created.temporaryPassword}</span>
          </span>
          <CopyButton value={created.temporaryPassword} label="Copy password" />
        </div>
        <DialogFooter>
          <Button onClick={onDone}>Done</Button>
        </DialogFooter>
      </>
    );
  return (
    <>
      <DialogHeader>
        <DialogTitle>Add a staff user</DialogTitle>
        <DialogDescription>Someone on our team. What they can see and do comes from their staff role.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-n`} label="Full name">
          <Input id={`${id}-n`} value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="off" />
        </Field>
        <Field id={`${id}-u`} label="Username" hint="Lowercase; they sign in with it.">
          <Input id={`${id}-u`} value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))} autoComplete="off" />
        </Field>
        <Field id={`${id}-e`} label="Email">
          <Input id={`${id}-e`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
        </Field>
        <Field id={`${id}-r`} label="Staff role">
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger id={`${id}-r`}>
              <SelectValue placeholder="Choose a role" />
            </SelectTrigger>
            <SelectContent>
              {(roles.data ?? []).map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!fullName.trim() || username.length < 3 || !email.trim() || !roleId || pending}
          onClick={async () => {
            const r = await run(() => accountsApi.createStaffUser({ fullName, username, email, staffRoleId: roleId }), { success: "Staff user added" });
            if (r.ok) setCreated(r.result);
          }}
        >
          Add staff user
        </Button>
      </DialogFooter>
    </>
  );
}

function UsernameDialog({ user, onClose }: { user: UserAccount | null; onClose: () => void }) {
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">{user ? <UsernameForm user={user} onDone={onClose} /> : null}</DialogContent>
    </Dialog>
  );
}

function UsernameForm({ user, onDone }: { user: UserAccount; onDone: () => void }) {
  const id = useId();
  const [value, setValue] = useState(user.username);
  const { run, pending } = useAction();
  return (
    <>
      <DialogHeader>
        <DialogTitle>Change username</DialogTitle>
        <DialogDescription>{user.fullName} signs in with the new username from now on. Tell them; their password and two-factor stay the same.</DialogDescription>
      </DialogHeader>
      <Field id={`${id}-u`} label="New username">
        <Input id={`${id}-u`} value={value} onChange={(e) => setValue(e.target.value.toLowerCase().replace(/\s/g, ""))} autoComplete="off" />
      </Field>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={value.length < 3 || value === user.username || pending}
          onClick={async () => {
            const r = await run(() => accountsApi.changeUsername(user.id, value), { success: "Username changed" });
            if (r.ok) onDone();
          }}
        >
          Change username
        </Button>
      </DialogFooter>
    </>
  );
}

function StaffRoleDialog({ user, onClose }: { user: UserAccount | null; onClose: () => void }) {
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">{user ? <StaffRoleForm user={user} onDone={onClose} /> : null}</DialogContent>
    </Dialog>
  );
}

function StaffRoleForm({ user, onDone }: { user: UserAccount; onDone: () => void }) {
  const id = useId();
  const roles = useResource(() => accountsApi.listStaffRoles(), ["staff-roles"]);
  const [roleId, setRoleId] = useState(user.staffRoleId ?? "");
  const { run, pending } = useAction();
  return (
    <>
      <DialogHeader>
        <DialogTitle>Change staff role</DialogTitle>
        <DialogDescription>What {user.fullName} can see and do changes at their next page load.</DialogDescription>
      </DialogHeader>
      <Field id={`${id}-r`} label="Staff role">
        <Select value={roleId} onValueChange={setRoleId}>
          <SelectTrigger id={`${id}-r`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(roles.data ?? []).map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!roleId || roleId === user.staffRoleId || pending}
          onClick={async () => {
            const r = await run(() => accountsApi.setStaffRoleOfUser(user.id, roleId), { success: "Staff role changed" });
            if (r.ok) onDone();
          }}
        >
          Save
        </Button>
      </DialogFooter>
    </>
  );
}
