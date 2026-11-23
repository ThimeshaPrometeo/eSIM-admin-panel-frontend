"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LogOut, RotateCcw, UserRound } from "lucide-react";
import { toast } from "sonner";
import { usePlatform } from "@/contexts/platform-context";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { errorMessage } from "@/lib/api/errors";
import { routeAccess } from "@/lib/platform/nav-config";
import type { Role } from "@/lib/platform/types";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "./confirm-dialog";

export const ROLE_LABEL: Record<Role, string> = { admin: "Admin", staff: "Staff", reseller: "Reseller", assistant: "Assistant" };

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Who you are, the demo role switcher, reset demo data, and sign out. */
export function UserMenu({ compact }: { compact?: boolean }) {
  const { me, isDemo, switchRole, resetDemo, signOut } = usePlatform();
  const router = useRouter();
  const [confirmReset, setConfirmReset] = useState(false);
  if (!me) return null;

  const role = ROLE_LABEL[me.role];
  const context = me.role === "staff" ? `${role} · ${me.staffRoleName ?? ""}` : me.resellerName ? `${role} · ${me.resellerName}` : role;

  const onSwitch = async (next: Role) => {
    if (next === me.role) return;
    try {
      const nextMe = await switchRole(next);
      toast.success(`Viewing as ${ROLE_LABEL[next].toLowerCase()}`, { description: `${nextMe.fullName}${nextMe.resellerName ? `, ${nextMe.resellerName}` : ""}` });
      // stay on the page if the new role may see it, else go to the dashboard
      const access = routeAccess(nextMe.role, nextMe.permissions, window.location.pathname);
      if (access.kind !== "ok") router.push("/esim/dashboard");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "group flex items-center gap-2.5 rounded-full p-1 pr-1 text-left outline-none transition-colors hover:bg-surface-3 focus-visible:ring-2 focus-visible:ring-primary",
            !compact && "sm:pr-3",
          )}
          aria-label="Account menu"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,var(--primary),var(--accent))] p-px">
            <span className="grid size-full place-items-center rounded-full bg-surface-2 text-small font-semibold">{initials(me.fullName)}</span>
          </span>
          {!compact ? (
            <span className="hidden min-w-0 flex-col leading-tight sm:flex">
              <span className="truncate text-body font-medium">{me.fullName}</span>
              <span className="truncate text-small text-fg-3">{context}</span>
            </span>
          ) : null}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <div className="px-3 py-2.5">
            <p className="truncate text-body font-medium">{me.fullName}</p>
            <p className="truncate text-small text-fg-3">{me.email}</p>
            <p className="mt-1 text-small text-fg-2">{context}</p>
          </div>
          {isDemo ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>View as (demo)</DropdownMenuLabel>
              {(["admin", "staff", "reseller", "assistant"] as Role[]).map((r) => (
                <DropdownMenuItem key={r} onSelect={() => void onSwitch(r)} className="justify-between">
                  <span className="flex flex-col">
                    <span>{ROLE_LABEL[r]}</span>
                    <span className="text-small text-fg-3">{ROLE_HINT[r]}</span>
                  </span>
                  {me.role === r ? <Check className="!text-primary" strokeWidth={1.75} /> : null}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onSelect={() => setConfirmReset(true)}>
                <RotateCcw strokeWidth={1.5} />
                Reset demo data
              </DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => router.push("/profile")}>
            <UserRound strokeWidth={1.5} />
            Profile and security
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={async () => {
              await signOut();
              router.replace("/");
            }}
          >
            <LogOut strokeWidth={1.5} />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset demo data?"
        description={`Everything changed in this demo goes back to the starting data. You stay signed in as ${role.toLowerCase()}.`}
        confirmLabel="Reset demo data"
        onConfirm={async () => {
          await resetDemo();
          setConfirmReset(false);
          toast.success("Demo data reset");
        }}
      />
    </>
  );
}

const ROLE_HINT: Record<Role, string> = {
  admin: "Nadeesha Perera",
  staff: "Kasun Silva, Support",
  reseller: "Amaya, Lanka Roam Travels",
  assistant: "Sahan, Lanka Roam Travels",
};
