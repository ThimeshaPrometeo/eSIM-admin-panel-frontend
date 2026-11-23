"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { AlertOctagon, AlertTriangle, Bell, Check, Eye, Info, Pencil, Plus, ShieldOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/platform/confirm-dialog";
import { DataTable, type Column } from "@/components/platform/data-table";
import { FilterSelect, ResellerSelect } from "@/components/platform/fields";
import { FitPage, FitScroll } from "@/components/platform/fit-page";
import { GlassCard } from "@/components/platform/glass-card";
import { PageHeader } from "@/components/platform/primitives";
import { StatusChip } from "@/components/platform/status-chip";
import { useAction } from "@/hooks/use-action";
import { usePermission } from "@/hooks/use-permission";
import { useResource } from "@/hooks/use-resource";
import { operationsApi } from "@/lib/api/operations";
import { formatDateTime, formatRelative } from "@/lib/platform/dates";
import { ALERT_STATUS, ALERT_TYPE_LABEL } from "@/lib/platform/status";
import type { Alert, AlertRule, AlertType } from "@/lib/platform/types";
import { cn } from "@/lib/utils";

type StatusFilter = "active" | "open" | "acknowledged" | "resolved" | "all";
const SEVERITY = {
  danger: { icon: AlertOctagon, className: "text-danger" },
  warning: { icon: AlertTriangle, className: "text-warning" },
  info: { icon: Info, className: "text-primary" },
} as const;

/** Alerts and rules (spec 8.9). Admin and staff handle alerts and set rules; resellers and assistants see their own alerts. */
export function AlertsClient() {
  const { isTenant, can } = usePermission();
  const manage = isTenant && can("alerts", "manage");
  const [tab, setTab] = useState("inbox");
  const [ruleDialog, setRuleDialog] = useState<AlertRule | "new" | null>(null);
  return (
    <FitPage>
      <PageHeader
        title={isTenant ? "Alerts and rules" : "Alerts"}
        description={isTenant ? "What needs attention, and the usage rules that raise alerts or suspend eSIMs." : "Alerts about your own eSIMs, such as data use reaching a rule's threshold. Read only."}
        actions={
          manage && tab === "rules" ? (
            <Button onClick={() => setRuleDialog("new")}>
              <Plus strokeWidth={1.5} />
              Add rule
            </Button>
          ) : null
        }
      />
      {isTenant ? (
        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="self-start">
            <TabsTrigger value="inbox">Alerts</TabsTrigger>
            <TabsTrigger value="rules">Usage rules</TabsTrigger>
          </TabsList>
          <div className="mt-4 flex min-h-0 flex-1 flex-col">{tab === "inbox" ? <Inbox manage={manage} /> : <Rules manage={manage} onEdit={setRuleDialog} />}</div>
        </Tabs>
      ) : (
        <Inbox manage={false} />
      )}
      <Dialog open={ruleDialog !== null} onOpenChange={(o) => !o && setRuleDialog(null)}>
        <DialogContent className="sm:max-w-lg">{ruleDialog ? <RuleForm rule={ruleDialog === "new" ? null : ruleDialog} onDone={() => setRuleDialog(null)} /> : null}</DialogContent>
      </Dialog>
    </FitPage>
  );
}

function Inbox({ manage }: { manage: boolean }) {
  const { isTenant } = usePermission();
  const [status, setStatus] = useState<StatusFilter | null>("active");
  const [type, setType] = useState<AlertType | null>(null);
  const [resellerId, setResellerId] = useState<string | null>(null);
  const { data, loading, error } = useResource(() => operationsApi.listAlerts({ status: status === "all" ? null : status, type, resellerId }), [status, type, resellerId]);
  const { run, pending } = useAction();

  const columns: Column<Alert>[] = [
    {
      id: "alert",
      header: "Alert",
      hideable: false,
      className: "whitespace-normal min-w-64",
      cell: (a) => {
        const S = SEVERITY[a.severity];
        return (
          <span className="flex items-start gap-3">
            <S.icon className={cn("mt-0.5 size-4 shrink-0", S.className)} strokeWidth={1.75} aria-label={a.severity} />
            <span className="flex min-w-0 flex-col">
              {a.href ? (
                <Link href={a.href} className="font-medium hover:text-primary">
                  {a.title}
                </Link>
              ) : (
                <span className="font-medium">{a.title}</span>
              )}
              <span className="text-small text-fg-2">{a.detail}</span>
            </span>
          </span>
        );
      },
      sortValue: (a) => a.title,
    },
    {
      id: "type",
      header: "Type",
      cell: (a) => (
        <span className="flex flex-col">
          <span>{ALERT_TYPE_LABEL[a.type]}</span>
          {a.rule ? <span className="text-small text-fg-3">Rule {a.rule}</span> : null}
        </span>
      ),
      sortValue: (a) => a.type,
    },
    ...(isTenant ? [{ id: "reseller", header: "Reseller", cell: (a: Alert) => a.resellerName ?? <span className="text-fg-3">—</span>, sortValue: (a: Alert) => a.resellerName ?? "" }] : []),
    { id: "when", header: "Raised", cell: (a) => <span className="text-fg-2" title={formatDateTime(a.createdAt)}>{formatRelative(a.createdAt)}</span>, sortValue: (a) => a.createdAt },
    {
      id: "status",
      header: "Status",
      cell: (a) => (
        <span className="flex flex-col items-start gap-0.5">
          <StatusChip status={a.status === "open" && a.severity === "danger" ? { label: "Open", tone: "danger" } : ALERT_STATUS[a.status]} />
          {a.status !== "open" && a.updatedByName ? <span className="text-small text-fg-3">by {a.updatedByName}</span> : null}
        </span>
      ),
      sortValue: (a) => a.status,
    },
    ...(manage
      ? [
          {
            id: "actions",
            header: "",
            hideable: false,
            align: "right" as const,
            cell: (a: Alert) =>
              a.status === "resolved" ? null : (
                <span className="inline-flex gap-1">
                  {a.status === "open" ? (
                    <Button size="icon" variant="ghost" aria-label="Acknowledge" title="Acknowledge: seen, being handled" disabled={pending} onClick={() => run(() => operationsApi.setAlertStatus(a.id, "acknowledged"), { success: "Alert acknowledged" })}>
                      <Eye strokeWidth={1.5} />
                    </Button>
                  ) : null}
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => operationsApi.setAlertStatus(a.id, "resolved"), { success: "Alert resolved" })}>
                    <Check strokeWidth={1.5} />
                    Resolve
                  </Button>
                </span>
              ),
          },
        ]
      : []),
  ];

  return (
    <DataTable
      rows={data}
      loading={loading}
      error={error}
      columns={columns}
      rowKey={(a) => a.id}
      defaultSort={{ id: "when", desc: true }}
      caption="Alerts"
      toolbar={
        <>
          <FilterSelect
            label="Status"
            value={status}
            onChange={setStatus}
            all="Any status"
            options={[
              { value: "active", label: "Open or acknowledged" },
              { value: "open", label: "Open" },
              { value: "acknowledged", label: "Acknowledged" },
              { value: "resolved", label: "Resolved" },
            ]}
            className="sm:w-56"
          />
          <FilterSelect label="Type" value={type} onChange={setType} all="Any type" options={(Object.keys(ALERT_TYPE_LABEL) as AlertType[]).map((t) => ({ value: t, label: ALERT_TYPE_LABEL[t] }))} className="sm:w-52" />
          {isTenant ? <ResellerSelect value={resellerId} onChange={setResellerId} /> : null}
        </>
      }
      empty={{ title: "Nothing needs attention", description: status === "active" ? "No open alerts. Resolved alerts are under “Resolved”." : "No alerts match.", illustration: "signal" }}
    />
  );
}

function Rules({ manage, onEdit }: { manage: boolean; onEdit: (r: AlertRule) => void }) {
  const { data } = useResource(() => operationsApi.listAlertRules(), ["alert-rules"]);
  const { run, pending } = useAction();
  const [removing, setRemoving] = useState<AlertRule | null>(null);
  return (
    <FitScroll>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-3">
          {(data ?? []).map((r) => (
            <GlassCard key={r.id} className={cn("flex flex-wrap items-center gap-4", !r.enabled && "opacity-70")}>
              <span className="grid size-11 shrink-0 place-items-center rounded-full border border-border-strong text-body font-semibold tabular">{r.thresholdPercent}%</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2 text-body font-medium">
                  {r.action === "notify" ? <Bell className="size-4 text-primary" strokeWidth={1.5} /> : <ShieldOff className="size-4 text-danger" strokeWidth={1.5} />}
                  At {r.thresholdPercent}% of a plan&apos;s data: {r.action === "notify" ? "notify" : "suspend the eSIM"}
                </span>
                <span className="text-small text-fg-2">
                  {r.action === "notify" ? "Raises an alert and notifies the reseller and our team." : "Suspends the eSIM (“Suspended by rule”), raises an alert and notifies. Only our team can reactivate it."}{" "}
                  {r.raised30d} alert{r.raised30d === 1 ? "" : "s"} in the last 30 days.
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Switch
                  checked={r.enabled}
                  disabled={!manage || pending}
                  aria-label={`Rule ${r.thresholdPercent}% ${r.enabled ? "on" : "off"}`}
                  onCheckedChange={(on) => run(() => operationsApi.updateAlertRule(r.id, { thresholdPercent: r.thresholdPercent, action: r.action, enabled: on }), { success: on ? "Rule switched on" : "Rule switched off" })}
                />
                {manage ? (
                  <>
                    <Button size="icon" variant="ghost" aria-label="Edit rule" onClick={() => onEdit(r)}>
                      <Pencil strokeWidth={1.5} />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Delete rule" onClick={() => setRemoving(r)}>
                      <Trash2 strokeWidth={1.5} />
                    </Button>
                  </>
                ) : null}
              </span>
            </GlassCard>
          ))}
        </div>
        <GlassCard className="flex flex-col gap-2 self-start">
          <h2 className="text-section font-semibold">How usage rules work</h2>
          <p className="text-body text-fg-2">
            Rules apply to every eSIM. Usage is read every 15 minutes; a rule fires when a running plan crosses its threshold.
          </p>
          <p className="text-body text-fg-2">Other alerts (low stock, wallets, late reports, orders being verified) are raised by the platform; their thresholds are in Settings.</p>
        </GlassCard>
      </div>
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Delete this rule?"
        description={`No more alerts${removing?.action === "auto_suspend" ? " or suspensions" : ""} at ${removing?.thresholdPercent ?? ""}%. Alerts it already raised stay.`}
        confirmLabel="Delete rule"
        destructive
        onConfirm={async () => {
          const r = await run(() => operationsApi.deleteAlertRule(removing!.id), { success: "Rule deleted" });
          if (r.ok) setRemoving(null);
        }}
      />
    </FitScroll>
  );
}

function RuleForm({ rule, onDone }: { rule: AlertRule | null; onDone: () => void }) {
  const id = useId();
  const [threshold, setThreshold] = useState(String(rule?.thresholdPercent ?? 90));
  const [action, setAction] = useState<AlertRule["action"]>(rule?.action ?? "notify");
  const { run, pending } = useAction();
  const n = Number(threshold);
  const valid = Number.isFinite(n) && n >= 1 && n <= 100;
  return (
    <>
      <DialogHeader>
        <DialogTitle>{rule ? "Edit rule" : "Add usage rule"}</DialogTitle>
        <DialogDescription>When an eSIM&apos;s plan reaches this share of its data.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-t`} label="Threshold (%)" error={threshold && !valid ? "Between 1 and 100." : undefined}>
          <Input id={`${id}-t`} inputMode="numeric" value={threshold} onChange={(e) => setThreshold(e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field id={`${id}-a`} label="Action">
          <Select value={action} onValueChange={(v) => setAction(v as AlertRule["action"])}>
            <SelectTrigger id={`${id}-a`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="notify">Notify</SelectItem>
              <SelectItem value="auto_suspend">Suspend the eSIM</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      {action === "auto_suspend" ? (
        <p className="rounded-control border border-[color-mix(in_oklab,var(--warning)_45%,transparent)] bg-[color-mix(in_oklab,var(--warning)_8%,transparent)] px-3 py-2 text-small">
          The customer loses data until our team reactivates the eSIM. Resellers can&apos;t lift a rule suspension.
        </p>
      ) : null}
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!valid || pending}
          onClick={async () => {
            const input = { thresholdPercent: n, action, enabled: rule?.enabled ?? true };
            const r = await run(() => (rule ? operationsApi.updateAlertRule(rule.id, input) : operationsApi.createAlertRule(input)), { success: rule ? "Rule saved" : "Rule added" });
            if (r.ok) onDone();
          }}
        >
          {rule ? "Save rule" : "Add rule"}
        </Button>
      </DialogFooter>
    </>
  );
}
