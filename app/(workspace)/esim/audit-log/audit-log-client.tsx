"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Detail, FilterSelect, PeriodSelect, SearchInput } from "@/components/platform/fields";
import { FitPage } from "@/components/platform/fit-page";
import { PageHeader } from "@/components/platform/primitives";
import { useResource } from "@/hooks/use-resource";
import { accountsApi } from "@/lib/api/accounts";
import { formatDateTime, formatRelative } from "@/lib/platform/dates";
import { periodFor, type Period } from "@/lib/platform/period";
import type { AuditRecord } from "@/lib/platform/types";

const ENTITY: Record<string, string> = {
  user: "User",
  order: "Order",
  reseller: "Reseller",
  discount: "Discount",
  price_list: "Price list",
  topup_request: "Top-up request",
  esim: "eSIM",
  settings: "Settings",
  alert: "Alert",
  alert_rule: "Alert rule",
  staff_role: "Staff role",
  customer: "Customer",
  catalogue: "Catalogue",
};
const entityLabel = (t: string) => ENTITY[t] ?? t.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/** Audit log (spec 8.28): who did what, when and from where; before/after for changes. */
export function AuditLogClient() {
  const [period, setPeriod] = useState<Period>(() => ({ ...periodFor("30d"), granularity: "day" }));
  const [q, setQ] = useState("");
  const [actorId, setActorId] = useState<string | null>(null);
  const [entityType, setEntityType] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);
  const [open, setOpen] = useState<AuditRecord | null>(null);
  const { data, loading, error } = useResource(
    () => accountsApi.listAudit({ q, actorId, entityType, action, from: period.from, to: period.to }),
    [q, actorId, entityType, action, period.from, period.to],
  );

  const columns: Column<AuditRecord>[] = [
    { id: "at", header: "When", hideable: false, cell: (a) => <span className="text-fg-2" title={formatDateTime(a.at)}>{formatRelative(a.at)}</span>, sortValue: (a) => a.at },
    {
      id: "who",
      header: "Who",
      cell: (a) => (
        <span className="flex flex-col">
          <span>{a.actorName}</span>
          {a.actorUsername ? <span className="font-mono text-small text-fg-3">{a.actorUsername}</span> : null}
        </span>
      ),
      sortValue: (a) => a.actorName,
    },
    {
      id: "what",
      header: "What",
      className: "whitespace-normal min-w-72",
      hideable: false,
      cell: (a) => (
        <span className="flex flex-col">
          <span>{a.summary}</span>
          <span className="font-mono text-small text-fg-3">
            {a.action}
            {a.changes?.length ? ` · ${a.changes.length} change${a.changes.length === 1 ? "" : "s"}` : ""}
          </span>
        </span>
      ),
      sortValue: (a) => a.action,
    },
    {
      id: "entity",
      header: "Entity",
      cell: (a) => (
        <span className="flex flex-col">
          <span>{entityLabel(a.entityType)}</span>
          <span className="font-mono text-small text-fg-3">{a.entityId}</span>
        </span>
      ),
      sortValue: (a) => a.entityType,
    },
    { id: "ip", header: "IP", cell: (a) => <span className="font-mono text-small text-fg-2">{a.ip ?? "—"}</span>, sortValue: (a) => a.ip ?? "" },
  ];

  return (
    <FitPage>
      <PageHeader title="Audit log" description="Every change, sign-in, PIN/PUK reveal and download. Open a row to see what changed." />
      <div className="flex flex-wrap items-center gap-2">
        <PeriodSelect value={period} onChange={setPeriod} />
        <FilterSelect label="User" value={actorId} onChange={setActorId} all="Anyone" options={[...(data?.options.actors ?? []).map((a) => ({ value: a.id, label: a.name })), { value: "system", label: "System" }]} />
        <FilterSelect label="Entity" value={entityType} onChange={setEntityType} all="Any entity" options={(data?.options.entityTypes ?? []).map((t) => ({ value: t, label: entityLabel(t) }))} className="sm:w-44" />
        <FilterSelect label="Action" value={action} onChange={setAction} all="Any action" options={(data?.options.actions ?? []).map((t) => ({ value: t, label: t }))} className="sm:w-60" />
      </div>
      <DataTable
        rows={data?.rows}
        loading={loading}
        error={error}
        columns={columns}
        rowKey={(a) => a.id}
        onRowClick={setOpen}
        defaultSort={{ id: "at", desc: true }}
        caption="Audit log"
        toolbar={<SearchInput value={q} onChange={setQ} placeholder="Search what happened or an ID" />}
        empty={{ title: "Nothing in this period", description: "Try a longer period or clear a filter." }}
      />
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="right" className="w-[min(560px,96vw)] overflow-y-auto">
          <SheetTitle>{open?.summary ?? ""}</SheetTitle>
          {open ? (
            <div className="flex flex-col gap-5">
              <SheetDescription className="font-mono">{open.action}</SheetDescription>
              <dl className="grid grid-cols-2 gap-4">
                <Detail label="When">{formatDateTime(open.at)}</Detail>
                <Detail label="Who">
                  {open.actorName}
                  {open.actorUsername ? <span className="block font-mono text-small text-fg-3">{open.actorUsername}</span> : null}
                </Detail>
                <Detail label="Entity">
                  {entityLabel(open.entityType)} <span className="font-mono text-small text-fg-3">{open.entityId}</span>
                </Detail>
                <Detail label="IP address">
                  <span className="font-mono text-small">{open.ip ?? "— (system)"}</span>
                </Detail>
                {open.resellerName ? <Detail label="Reseller">{open.resellerName}</Detail> : null}
              </dl>
              <div className="flex flex-col gap-2">
                <h3 className="text-body font-semibold">What changed</h3>
                {open.changes?.length ? (
                  <ul className="flex flex-col divide-y divide-border rounded-control border border-border">
                    {open.changes.map((c) => (
                      <li key={c.field} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 px-4 py-3">
                        <span className="text-small text-fg-3">{c.field}</span>
                        <span />
                        <span className="col-span-2 flex flex-wrap items-center gap-2 text-body">
                          <span className="rounded bg-[color-mix(in_oklab,var(--danger)_12%,transparent)] px-1.5 line-through decoration-fg-3">{c.before}</span>
                          <ArrowRight className="size-4 text-fg-3" strokeWidth={1.5} />
                          <span className="rounded bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] px-1.5">{c.after}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-body text-fg-3">No field changes recorded for this event.</p>
                )}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </FitPage>
  );
}
