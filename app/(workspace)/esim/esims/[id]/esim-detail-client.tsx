"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Ban, CalendarPlus, Download, Eye, FileDown, Mail, MoreHorizontal, PauseCircle, PlayCircle, Plus, Power, Trash2, Unlock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { UsageAreaChart, usageSeries } from "@/components/platform/charts/charts";
import { ConfirmDialog } from "@/components/platform/confirm-dialog";
import { DataTable, type Column } from "@/components/platform/data-table";
import { AddDataDialog, EmailQrDialog, ExtendPlanDialog } from "@/components/platform/esim-dialogs";
import { EsimCard } from "@/components/platform/esim-card";
import { CopyButton, Detail, UnitSelect } from "@/components/platform/fields";
import { GlassCard, SectionCard } from "@/components/platform/glass-card";
import { EmptyState } from "@/components/platform/primitives";
import { EstimatedChip, StatusChip } from "@/components/platform/status-chip";
import { UsageBar } from "@/components/platform/usage";
import { usePlatform } from "@/contexts/platform-context";
import { useAction } from "@/hooks/use-action";
import { usePermission } from "@/hooks/use-permission";
import { useResource } from "@/hooks/use-resource";
import { FIT_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { logDownload } from "@/lib/api/audit";
import { errorMessage } from "@/lib/api/errors";
import { esimsApi } from "@/lib/api/esims";
import { exportCsv, exportPdf, type ExportColumn } from "@/lib/exports";
import { countryFlag } from "@/lib/platform/coverage";
import { addDays, dateInZone, formatAxisDate, formatDate, formatDateTime, formatRelative } from "@/lib/platform/dates";
import { formatMoney, toNumber } from "@/lib/platform/money";
import { isLive } from "@/lib/platform/plan-state";
import { esimStatus, installStatus, PLAN_STATE, type PlanState } from "@/lib/platform/status";
import type { EsimActivity, EsimCredentials, EsimPlan, UsageByNetwork } from "@/lib/platform/types";
import { formatBytes, formatPlanData, toUnit, type DataUnit } from "@/lib/platform/units";
import { cn } from "@/lib/utils";

type Confirm =
  | { kind: "suspend" | "reactivate" | "eol" }
  | { kind: "block" | "unblock" | "delete" | "cancel"; plan: EsimPlan }
  | null;

const ACTIVATION = { now: "Activated at sale", first_use: "On first use", date: "On a set date" } as const;
const WAITING: PlanState[] = ["awaiting_funds", "blocked_no_funds"];

/** eSIM detail (spec 8.3, 8.4). */
export function EsimDetailClient({ id }: { id: string }) {
  const { me } = usePlatform();
  const { rules, can } = usePermission();
  const { data: e, error } = useResource(() => esimsApi.getEsim(id), [id]);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [extend, setExtend] = useState<EsimPlan | null>(null);
  const [addData, setAddData] = useState<EsimPlan | null>(null);
  const [emailQr, setEmailQr] = useState(false);
  const [creds, setCreds] = useState<EsimCredentials | null>(null);
  const qrCanvas = useRef<HTMLDivElement>(null);
  const { run, pending } = useAction();
  const fit = useMediaQuery(FIT_QUERY);
  const [tab, setTab] = useState("plans");

  if (error)
    return (
      <EmptyState
        illustration="sim"
        title="eSIM not found"
        description={errorMessage(error)}
        action={
          <Button asChild variant="secondary">
            <Link href="/esim/esims">Back to eSIMs</Link>
          </Button>
        }
      />
    );

  const live = e?.plans.filter((p) => isLive(p.state)) ?? [];
  const main = live.find((p) => p.state === "active") ?? live[0] ?? e?.plans[0];
  const eol = e?.status === "END_OF_LIFE";
  const suspended = e?.status === "SUSPENDED";
  const canManage = rules.canManageEsims(me);
  const canPlans = rules.canManagePlansOnEsim(me);

  const downloadQr = () => {
    const canvas = qrCanvas.current?.querySelector("canvas");
    if (!canvas || !e) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `esim-${e.iccid}.png`;
    a.click();
    toast.success("QR code downloaded");
  };

  if (!e) return <Skeleton className="h-[70dvh]" />;

  const idBlock = (
              <div className="min-w-0">
                <p className="text-small text-fg-3">ICCID</p>
                <p className="flex items-center gap-1 font-mono text-section tabular">
                  <span className="truncate">{e.iccid}</span>
                  <CopyButton value={e.iccid} label="Copy ICCID" />
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusChip status={esimStatus(e.status, e.suspendedBy)} />
                  <StatusChip status={installStatus(e.installStatus, e.installStatusRaw)} />
                </div>
              </div>
  );
  const actionBar = (
              <div className="flex flex-wrap gap-2">
                {rules.canSell(me) && !eol ? (
                  <Button asChild>
                    <Link href={`/esim/sell?esim=${e.id}`}>
                      <Plus strokeWidth={1.75} />
                      Add plan
                    </Link>
                  </Button>
                ) : null}
                {canManage && !eol ? (
                  suspended ? (
                    rules.canReactivate(me, e.suspendedBy) ? (
                      <Button variant="secondary" onClick={() => setConfirm({ kind: "reactivate" })}>
                        <PlayCircle strokeWidth={1.5} />
                        Reactivate eSIM
                      </Button>
                    ) : null
                  ) : (
                    <Button variant="secondary" onClick={() => setConfirm({ kind: "suspend" })}>
                      <PauseCircle strokeWidth={1.5} />
                      Suspend eSIM
                    </Button>
                  )
                ) : null}
                {rules.canSetEndOfLife(me) && !eol ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="icon" aria-label="More actions">
                        <MoreHorizontal strokeWidth={1.5} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem destructive onSelect={() => setConfirm({ kind: "eol" })}>
                        <Power strokeWidth={1.5} />
                        Set end of life
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
  );
  const noticeBlock = (
    <>
            {suspended && !rules.canReactivate(me, e.suspendedBy) ? (
              <p className="rounded-control border border-border bg-surface-2/60 px-4 py-3 text-body text-fg-2">
                {e.suspendedBy === "rule" ? "An alert rule suspended this eSIM." : "An administrator suspended this eSIM."} Only an administrator can reactivate it.
              </p>
            ) : null}
            {eol ? <p className="rounded-control border border-border bg-surface-2/60 px-4 py-3 text-body text-fg-2">This eSIM is at end of life. Only the supplier can re-enable it.</p> : null}
    </>
  );
  const detailList = (
            <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3">
              {e.resellerName !== null || me?.role === "admin" || me?.role === "staff" ? <Detail label="Reseller">{e.resellerName ?? "Direct sale"}</Detail> : null}
              <Detail label="Customer">
                {e.customerName ?? <span className="text-fg-3">None</span>}
                {e.customerEmail ? (
                  <span className="block truncate text-small text-fg-3" title={e.customerEmail}>
                    {e.customerEmail}
                  </span>
                ) : null}
              </Detail>
              <Detail label="Sold">{formatDate(e.createdAt)}</Detail>
              <Detail label="Last activity">{e.lastActivityAt ? formatRelative(e.lastActivityAt) : <span className="text-fg-3">No use yet</span>}</Detail>
              <Detail label="Current plans">{live.length || <span className="text-fg-3">None</span>}</Detail>
              <Detail label="Expires">{formatDate(e.expiresAt)}</Detail>
            </dl>
  );
  const installCard = (
          <SectionCard
            title="Install details"
            description="Scan the QR code, or enter the details by hand on the phone."
            actions={
              <>
                <Button variant="secondary" size="sm" onClick={downloadQr}>
                  <Download strokeWidth={1.5} />
                  QR code
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setEmailQr(true)}>
                  <Mail strokeWidth={1.5} />
                  Email
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-5 sm:flex-row">
              <div className="shrink-0 self-start rounded-control bg-white p-3" aria-label="QR code for installing this eSIM" role="img">
                <QRCodeSVG value={e.lpa} size={132} level="M" />
              </div>
              <div ref={qrCanvas} className="hidden" aria-hidden="true">
                <QRCodeCanvas value={e.lpa} size={512} level="M" marginSize={4} />
              </div>
              <dl className="flex min-w-0 flex-col gap-3">
                {[
                  ["Activation code", e.activationCode],
                  ["SM-DP+ address", e.smdpAddress],
                  ["LPA string", e.lpa],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-small text-fg-3">{label}</dt>
                    <dd className="flex items-center gap-1">
                      <span className="min-w-0 break-all font-mono text-small">{value}</span>
                      <CopyButton value={value!} label={`Copy ${label}`} />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </SectionCard>
  );
  const pinCard = (
          <SectionCard title="PIN and PUK" description="Read live from the supplier when you ask; never stored. Every view is recorded.">
            {creds ? (
              <dl className="grid grid-cols-2 gap-4">
                {(
                  [
                    ["PIN 1", creds.pin1],
                    ["PUK 1", creds.puk1],
                    ["PIN 2", creds.pin2],
                    ["PUK 2", creds.puk2],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-small text-fg-3">{label}</dt>
                    <dd className="flex items-center gap-1 font-mono text-section tabular">
                      {value}
                      <CopyButton value={value} label={`Copy ${label}`} />
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <Button
                variant="secondary"
                disabled={pending}
                onClick={async () => {
                  const r = await run(() => esimsApi.getEsimCredentials(e.id), { silent: false });
                  if (r.ok) setCreds(r.result);
                }}
              >
                <Eye strokeWidth={1.5} />
                Show PIN and PUK
              </Button>
            )}
          </SectionCard>
  );
  const plansSection = (
        <PlansSection
          plans={e.plans}
          onExtend={canPlans ? setExtend : undefined}
          onAddData={canPlans ? setAddData : undefined}
          onBlock={canPlans ? (p) => setConfirm({ kind: p.state === "blocked_by_admin" ? "unblock" : "block", plan: p }) : undefined}
          onDelete={rules.canDeletePlans(me) ? (p) => setConfirm({ kind: "delete", plan: p }) : undefined}
          onCancel={rules.canCancelWaitingPlan(me) ? (p) => setConfirm({ kind: "cancel", plan: p }) : undefined}
          eol={eol}
        />
  );
  const usageSection = can("usage") ? <UsageSection id={e.id} iccid={e.iccid} /> : null;
  const dialogLayer = (
    <>
        <>
          <ExtendPlanDialog esimId={e.id} plan={extend} onOpenChange={(o) => !o && setExtend(null)} />
          <AddDataDialog esimId={e.id} plan={addData} onOpenChange={(o) => !o && setAddData(null)} />
          <EmailQrDialog esimId={e.id} open={emailQr} onOpenChange={setEmailQr} defaultEmail={e.customerEmail} />
          <ConfirmDialog
            open={!!confirm}
            onOpenChange={(o) => !o && setConfirm(null)}
            {...confirmProps(confirm, e.iccid)}
            onConfirm={async ({ reason }) => {
              if (!confirm) return;
              const r = await run(
                () => {
                  switch (confirm.kind) {
                    case "suspend":
                      return esimsApi.suspendEsim(e.id, { reason });
                    case "reactivate":
                      return esimsApi.reactivateEsim(e.id, { reason });
                    case "eol":
                      return esimsApi.setEndOfLife(e.id, { reason: reason ?? "", confirmation: e.iccid });
                    case "block":
                    case "unblock":
                      return esimsApi.setPackageBlocked(e.id, confirm.plan.id, { blocked: confirm.kind === "block", reason: reason ?? "" });
                    case "delete":
                      return esimsApi.deletePackage(e.id, confirm.plan.id, { reason: reason ?? "" });
                    case "cancel":
                      return esimsApi.cancelOrder(confirm.plan.orderId);
                  }
                },
                { success: SUCCESS[confirm.kind] },
              );
              if (r.ok) setConfirm(null);
            }}
          />
        </>
    </>
  );
  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
      <Link href="/esim/esims">
        <ArrowLeft strokeWidth={1.5} />
        eSIMs
      </Link>
    </Button>
  );
  const card = <EsimCard iccid={e.iccid} planName={main?.name ?? "No plan"} lpa={e.lpa} usedBytes={main?.usedBytes ?? 0} limitBytes={main?.limitBytes ?? 0} statusLabel={esimStatus(e.status, e.suspendedBy).label} />;

  // Desktop: one screen. The eSIM on the left; plans, usage, install details and activity as tabs on the right.
  if (fit)
    return (
      <div className="grid h-[calc(100dvh-104px)] min-h-[560px] grid-cols-[360px_1fr] gap-4 2xl:grid-cols-[400px_1fr]">
        <GlassCard className="flex min-h-0 flex-col gap-5 overflow-y-auto">
          {back}
          {card}
          {idBlock}
          {actionBar}
          {noticeBlock}
          <div className="[&_dl]:grid-cols-2 [&_dl]:sm:grid-cols-2">{detailList}</div>
        </GlassCard>
        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 min-w-0 flex-col">
          <TabsList className="self-start">
            <TabsTrigger value="plans">Plans ({e.plans.length})</TabsTrigger>
            {usageSection ? <TabsTrigger value="usage">Usage</TabsTrigger> : null}
            <TabsTrigger value="install">Install details</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto pb-2 pr-1">
            {tab === "plans" ? plansSection : tab === "usage" ? usageSection : tab === "install" ? <div className="flex flex-col gap-4">{installCard}{pinCard}</div> : <ActivitySection id={e.id} />}
          </div>
        </Tabs>
        {dialogLayer}
      </div>
    );

  // Phones, tablets and short screens: stacked.
  return (
    <div className="flex flex-col gap-6">
      {back}
      <GlassCard className="grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr] lg:items-center">
        <div className="mx-auto w-full max-w-[420px]">{card}</div>
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            {idBlock}
            {actionBar}
          </div>
          {noticeBlock}
          {detailList}
        </div>
      </GlassCard>
      <div className="grid gap-4 lg:grid-cols-2">
        {installCard}
        {pinCard}
      </div>
      {plansSection}
      {usageSection}
      <ActivitySection id={e.id} />
      {dialogLayer}
    </div>
  );
}

const SUCCESS = {
  suspend: "eSIM suspended",
  reactivate: "eSIM reactivated",
  eol: "eSIM set to end of life",
  block: "Plan blocked",
  unblock: "Plan unblocked",
  delete: "Plan deleted",
  cancel: "Plan cancelled",
} as const;

function confirmProps(c: Confirm, iccid: string) {
  if (!c) return { title: "", description: "", confirmLabel: "" };
  switch (c.kind) {
    case "suspend":
      return { title: "Suspend this eSIM?", description: "Data stops at once. Running plans keep their hold; nothing is charged while suspended.", confirmLabel: "Suspend eSIM", destructive: true };
    case "reactivate":
      return { title: "Reactivate this eSIM?", description: "Data works again on its current plans.", confirmLabel: "Reactivate eSIM" };
    case "eol":
      return {
        title: "Set end of life?",
        description: "The eSIM stops for good and its plans end; unused holds are released.",
        warning: "Only the supplier can reverse this.",
        confirmLabel: "Set end of life",
        destructive: true,
        requireReason: true,
        typeToConfirm: { value: iccid, label: "Type the ICCID to confirm" },
      };
    case "block":
      return { title: `Block ${c.plan.name}?`, description: "The plan stops using data until an administrator or staff member unblocks it, even if it's funded.", confirmLabel: "Block plan", destructive: true, requireReason: true };
    case "unblock":
      return { title: `Unblock ${c.plan.name}?`, description: "It starts again, unless it's still waiting for funds.", confirmLabel: "Unblock plan", requireReason: true };
    case "delete":
      return { title: `Delete ${c.plan.name}?`, description: "The plan ends now and the unused part of its hold is released.", confirmLabel: "Delete plan", destructive: true, requireReason: true, typeToConfirm: { value: "DELETE", label: "Type DELETE to confirm" } };
    case "cancel":
      return { title: `Cancel ${c.plan.name}?`, description: "It's waiting for funds and hasn't started; nothing was charged. Its place in the funding queue is given up.", confirmLabel: "Cancel plan", destructive: true };
  }
}

function PlansSection({
  plans,
  onExtend,
  onAddData,
  onBlock,
  onDelete,
  onCancel,
  eol,
}: {
  plans: EsimPlan[];
  onExtend?: (p: EsimPlan) => void;
  onAddData?: (p: EsimPlan) => void;
  onBlock?: (p: EsimPlan) => void;
  onDelete?: (p: EsimPlan) => void;
  onCancel?: (p: EsimPlan) => void;
  eol: boolean;
}) {
  const columns: Column<EsimPlan>[] = [
    {
      id: "plan",
      header: "Plan",
      cell: (p) => (
        <span className="flex flex-col">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{p.name}</span>
            <StatusChip status={PLAN_STATE[p.state]} className="h-5 text-[11px]" />
          </span>
          <span className="text-small text-fg-3">
            {ACTIVATION[p.activation]}
            {p.expiresAt ? ` · ${p.state === "expired" || p.state === "ended" ? "ended" : "expires"} ${formatDate(p.expiresAt)}` : ""}
          </span>
        </span>
      ),
      hideable: false,
      className: "whitespace-normal min-w-36",
    },
    { id: "start", header: "Started", cell: (p) => (p.startedAt ? formatDate(p.startedAt) : <span className="text-fg-3">Not yet</span>), sortValue: (p) => p.startedAt ?? "", defaultHidden: true },

    {
      id: "data",
      header: "Data",
      cell: (p) => (
        <span className="flex w-24 flex-col gap-1.5">
          <span className="text-small text-fg-2 tabular">
            {formatBytes(p.usedBytes)} of {formatPlanData(p.limitBytes)}
          </span>
          <UsageBar used={p.usedBytes} limit={p.limitBytes} />
        </span>
      ),
    },
    {
      id: "hold",
      header: "Hold",
      align: "right",
      cell: (p) => (
        <span className="flex flex-col items-end gap-0.5">
          <span>{formatMoney(p.hold.amount)}</span>
          <span className="text-small text-fg-3">{formatMoney(p.hold.used)} charged</span>
          {toNumber(p.charges.estimated) > 0 ? <EstimatedChip className="h-5 text-[11px]" /> : null}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      hideable: false,
      cell: (p) => {
        const waiting = WAITING.includes(p.state);
        const running = isLive(p.state) && !waiting;
        const items: { label: string; icon: typeof Ban; onSelect: () => void; destructive?: boolean }[] = [];
        if (!eol && waiting && onCancel) items.push({ label: "Cancel plan", icon: Ban, onSelect: () => onCancel(p), destructive: true });
        if (!eol && (running || p.state === "expired") && onExtend) items.push({ label: "Extend expiry", icon: CalendarPlus, onSelect: () => onExtend(p) });
        if (!eol && running && onAddData) items.push({ label: "Add data", icon: Plus, onSelect: () => onAddData(p) });
        if (!eol && (running || p.state === "blocked_by_admin") && onBlock) items.push({ label: p.state === "blocked_by_admin" ? "Unblock plan" : "Block plan", icon: p.state === "blocked_by_admin" ? Unlock : Ban, onSelect: () => onBlock(p) });
        if (!eol && isLive(p.state) && onDelete) items.push({ label: "Delete plan", icon: Trash2, onSelect: () => onDelete(p), destructive: true });
        if (!items.length) return null;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${p.name}`}>
                <MoreHorizontal strokeWidth={1.5} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {items.map((it, i) => (
                <span key={it.label}>
                  {it.destructive && i > 0 ? <DropdownMenuSeparator /> : null}
                  <DropdownMenuItem destructive={it.destructive} onSelect={it.onSelect}>
                    <it.icon strokeWidth={1.5} />
                    {it.label}
                  </DropdownMenuItem>
                </span>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-section font-semibold">Plans on this eSIM</h2>
        <p className="text-small text-fg-2">An eSIM can carry many plans. Each holds its maximum cost from the wallet; usage is charged from the hold.</p>
      </div>
      <DataTable rows={plans} columns={columns} rowKey={(p) => p.id} pageSize={10} caption="Plans on this eSIM" empty={{ title: "No plans", description: "Add a plan to start using data." }} />
    </section>
  );
}

function UsageSection({ id, iccid }: { id: string; iccid: string }) {
  const { me } = usePlatform();
  const [days, setDays] = useState(30);
  const [unit, setUnit] = useState<DataUnit>("MB");
  const period = useMemo(() => {
    const to = dateInZone(new Date());
    return { from: addDays(to, -(days - 1)), to };
  }, [days]);
  const { data } = useResource(() => esimsApi.getEsimUsage(id, period), [id, period.from, period.to]);
  const v = (b: number) => Math.round(toUnit(b, unit) * 100) / 100;
  const chart = usageSeries((data?.daily ?? []).map((d) => ({ label: formatAxisDate(d.date), value: v(d.bytes), estimated: d.estimated })));
  const cols: ExportColumn<{ date: string; bytes: number; estimated: boolean }>[] = [
    { header: "Date", value: (r) => r.date },
    { header: "Data (MB)", value: (r) => Math.round((r.bytes / 1048576) * 10) / 10 },
    { header: "Status", value: (r) => (r.estimated ? "Estimated" : "Final") },
  ];
  const download = async (kind: "csv" | "pdf") => {
    if (!data || !me) return;
    const name = `usage-${iccid}-${period.from}-${period.to}`;
    try {
      if (kind === "csv") exportCsv(`${name}.csv`, cols, data.daily);
      else await exportPdf({ fileName: `${name}.pdf`, title: `Usage for eSIM ${iccid}`, subtitle: `${formatDate(period.from)} to ${formatDate(period.to)} · estimated days are not final yet`, columns: cols, rows: data.daily, watermark: { fullName: me.fullName, username: me.username } });
      await logDownload("usage_report", `${iccid}:${kind}`);
      toast.success(kind === "csv" ? "CSV downloaded" : "PDF downloaded");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const netColumns: Column<UsageByNetwork>[] = [
    { id: "country", header: "Country", cell: (n) => <span className="flex items-center gap-2">{countryFlag(n.iso2)} {n.country}</span>, sortValue: (n) => n.country, hideable: false },
    { id: "network", header: "Network", cell: (n) => n.operator, sortValue: (n) => n.operator },
    { id: "data", header: "Data", align: "right", cell: (n) => formatBytes(n.bytes, unit), sortValue: (n) => n.bytes },
    {
      id: "amount",
      header: "Charged",
      align: "right",
      cell: (n) => (
        <span className="inline-flex items-center gap-2">
          {n.estimated ? <EstimatedChip className="h-5 text-[11px]" /> : null}
          {formatMoney(n.amount)}
        </span>
      ),
      sortValue: (n) => toNumber(n.amount),
    },
  ];
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-section font-semibold">Usage</h2>
          <p className="text-small text-fg-2">Per day, then by country and network.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Period" className="glass-card inline-flex h-10 items-center gap-0.5 !rounded-full p-1">
            {[7, 30, 90].map((d) => (
              <button key={d} role="radio" aria-checked={days === d} onClick={() => setDays(d)} className={cn("h-8 rounded-full px-3 text-small font-medium", days === d ? "bg-surface-3 text-fg" : "text-fg-2 hover:text-fg")}>
                {d} days
              </button>
            ))}
          </div>
          <UnitSelect value={unit} onChange={setUnit} />
          <Button variant="secondary" size="sm" onClick={() => download("csv")} disabled={!data}>
            <FileDown strokeWidth={1.5} />
            CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => download("pdf")} disabled={!data}>
            <FileDown strokeWidth={1.5} />
            PDF
          </Button>
        </div>
      </div>
      <UsageAreaChart data={chart} unit={unit} title="Data per day" description={`${unit}; dashed = estimated until the nightly report`} />
      <DataTable rows={data?.byNetwork} loading={!data} columns={netColumns} rowKey={(n) => `${n.iso2}-${n.operator}`} caption="Usage by country and network" empty={{ title: "No usage in this period", description: "Usage appears once the eSIM is used.", illustration: "signal" }} />
    </section>
  );
}

function ActivitySection({ id }: { id: string }) {
  const { data } = useResource(() => esimsApi.getEsimActivity(id), [id]);
  const tone: Record<EsimActivity["kind"], string> = {
    order: "var(--primary)",
    plan: "var(--accent)",
    status: "var(--warning)",
    install: "var(--primary)",
    alert: "var(--danger)",
    credentials_viewed: "var(--neutral)",
  };
  return (
    <SectionCard title="Activity" description="Orders, plan changes, status and install changes, PIN and PUK views.">
      {!data ? (
        <Skeleton className="h-40" />
      ) : !data.length ? (
        <p className="text-body text-fg-3">Nothing yet.</p>
      ) : (
        <ol className="relative flex flex-col gap-5 border-l border-border pl-6">
          {data.slice(0, 20).map((a) => (
            <li key={a.id} className="relative">
              <span aria-hidden="true" className="absolute -left-[29px] top-1.5 size-2.5 rounded-full" style={{ background: tone[a.kind], boxShadow: `0 0 8px ${tone[a.kind]}` }} />
              <p className="text-body">{a.title}</p>
              <p className="text-small text-fg-3">
                {formatDateTime(a.at)}
                {a.actor ? ` · ${a.actor}` : ""}
                {a.detail ? ` · ${a.detail}` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}
