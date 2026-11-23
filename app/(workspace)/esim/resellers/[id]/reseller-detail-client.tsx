"use client";

import { FitPage, FitScroll } from "@/components/platform/fit-page";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, FileDown, MoreHorizontal, Pencil, Percent, Plus, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsageAreaChart } from "@/components/platform/charts/charts";
import { ConfirmDialog } from "@/components/platform/confirm-dialog";
import { DataTable, type Column } from "@/components/platform/data-table";
import { DiscountForm } from "@/components/platform/discount-dialog";
import { esimColumns } from "@/components/platform/esim-columns";
import { Detail } from "@/components/platform/fields";
import { GlassCard } from "@/components/platform/glass-card";
import { EmptyState, StatBlock } from "@/components/platform/primitives";
import { EditResellerForm, MarkupForm, WalletCreditForm } from "@/components/platform/reseller-dialogs";
import { StatusChip } from "@/components/platform/status-chip";
import { HoldsTable, ledgerColumns } from "@/components/platform/wallet-tables";
import { usePlatform } from "@/contexts/platform-context";
import { useAction } from "@/hooks/use-action";
import { usePermission } from "@/hooks/use-permission";
import { useResource } from "@/hooks/use-resource";
import { logDownload } from "@/lib/api/audit";
import { catalogueApi } from "@/lib/api/catalogue";
import { dashboardApi } from "@/lib/api/dashboard";
import { errorMessage } from "@/lib/api/errors";
import { esimsApi } from "@/lib/api/esims";
import { peopleApi } from "@/lib/api/people";
import { walletsApi } from "@/lib/api/wallets";
import { exportPdf } from "@/lib/exports";
import { formatAxisDate, formatDate, formatDateTime, formatRelative } from "@/lib/platform/dates";
import { formatMoney, toNumber } from "@/lib/platform/money";
import { enabledCount, RESELLER_MATRIX } from "@/lib/platform/permission-matrix";
import { periodFor } from "@/lib/platform/period";
import { RESELLER_STATUS, USER_STATUS } from "@/lib/platform/status-labels";
import type { Assistant, AuditEntry, Customer, Discount, DocumentRow, Reseller } from "@/lib/platform/types";
import { toUnit } from "@/lib/platform/units";

type Dialogs = "edit" | "markup" | "wallet" | "discount" | "status" | null;

/** Reseller detail (spec 8.15). */
export function ResellerDetailClient({ id }: { id: string }) {
  const { me, rules } = usePermission();
  const { data: r, error } = useResource(() => peopleApi.getReseller(id), [id]);
  const [dialog, setDialog] = useState<Dialogs>(null);
  const [tab, setTab] = useState("overview");
  const { run } = useAction();

  if (error)
    return (
      <EmptyState
        illustration="signal"
        title="Reseller not found"
        description={errorMessage(error)}
        action={
          <Button asChild variant="secondary">
            <Link href="/esim/resellers">Back to resellers</Link>
          </Button>
        }
      />
    );

  const manage = rules.canManageResellers(me);
  return (
    <FitPage>
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href="/esim/resellers">
          <ArrowLeft strokeWidth={1.5} />
          Resellers
        </Link>
      </Button>

      {!r ? (
        <Skeleton className="h-44" />
      ) : (
        <GlassCard>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-title font-semibold">{r.companyName}</h1>
                <StatusChip status={RESELLER_STATUS[r.status]} />
              </div>
              <p className="mt-1 text-body text-fg-2">
                {r.contactName} · {r.email} · {r.phone}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {rules.canAdjustWallet(me) ? (
                <Button onClick={() => setDialog("wallet")}>
                  <Wallet strokeWidth={1.5} />
                  Top up wallet
                </Button>
              ) : null}
              {rules.canChangeMarkup(me) ? (
                <Button variant="secondary" onClick={() => setDialog("markup")}>
                  <Percent strokeWidth={1.5} />
                  Change markup
                </Button>
              ) : null}
              {manage ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="icon" aria-label="More actions">
                      <MoreHorizontal strokeWidth={1.5} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setDialog("edit")}>
                      <Pencil strokeWidth={1.5} />
                      Edit details
                    </DropdownMenuItem>
                    <DropdownMenuItem destructive={r.status === "active"} onSelect={() => setDialog("status")}>
                      {r.status === "active" ? "Suspend reseller" : "Reactivate reseller"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
            <Detail label="Available">
              <span className="text-section font-semibold tabular">{formatMoney(r.wallet.available)}</span>
            </Detail>
            <Detail label="Held for running plans">
              <span className="tabular">{formatMoney(r.wallet.reserved)}</span>
            </Detail>
            <Detail label="Outstanding">
              <span className={toNumber(r.wallet.outstanding) > 0 ? "font-medium text-danger tabular" : "text-fg-3"}>{toNumber(r.wallet.outstanding) > 0 ? formatMoney(r.wallet.outstanding) : "None"}</span>
            </Detail>
            <Detail label="Waiting for funds">
              {r.wallet.waitingPlans ? `${r.wallet.waitingPlans} plan${r.wallet.waitingPlans > 1 ? "s" : ""} · ${formatMoney(r.wallet.waitingAmount)}` : <span className="text-fg-3">None</span>}
            </Detail>
            {r.markupPercent !== null ? (
              <Detail label={rules.canChangeMarkup(me) ? "Markup" : "Markup (read only)"}>
                <span className="tabular">{r.markupPercent}%</span>
              </Detail>
            ) : null}
            <Detail label="Discount">{r.discountPercent ? `${r.discountPercent}% on all plans` : <span className="text-fg-3">None</span>}</Detail>
          </dl>
          {toNumber(r.wallet.outstanding) > 0 ? (
            <p className="mt-5 rounded-control border border-[color-mix(in_oklab,var(--danger)_40%,transparent)] bg-[color-mix(in_oklab,var(--danger)_8%,transparent)] px-4 py-3 text-body">
              Usage of {formatMoney(r.wallet.outstanding)} wasn&apos;t covered by the wallet. New plans are refused until a top-up pays it.
            </p>
          ) : null}
        </GlassCard>
      )}

<FitScroll>
      <Tabs value={tab} onValueChange={setTab}>
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="esims">eSIMs</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="wallet">Wallet and ledger</TabsTrigger>
            <TabsTrigger value="discounts">Discounts</TabsTrigger>
            <TabsTrigger value="assistants">Assistants</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="audit">Audit trail</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="overview">{r ? <OverviewTab reseller={r} /> : null}</TabsContent>
        <TabsContent value="esims">{tab === "esims" ? <EsimsTab id={id} /> : null}</TabsContent>
        <TabsContent value="customers">{tab === "customers" ? <CustomersTab id={id} /> : null}</TabsContent>
        <TabsContent value="wallet">{tab === "wallet" && r ? <WalletTab reseller={r} /> : null}</TabsContent>
        <TabsContent value="discounts">{tab === "discounts" ? <DiscountsTab id={id} onAdd={rules.canEditDiscounts(me) ? () => setDialog("discount") : undefined} /> : null}</TabsContent>
        <TabsContent value="assistants">{tab === "assistants" ? <AssistantsTab id={id} /> : null}</TabsContent>
        <TabsContent value="documents">{tab === "documents" && r ? <DocumentsTab reseller={r} /> : null}</TabsContent>
        <TabsContent value="audit">{tab === "audit" ? <AuditTab id={id} /> : null}</TabsContent>
      </Tabs>

      {r ? (
        <>
          <Dialog open={dialog === "edit" || dialog === "markup" || dialog === "wallet" || dialog === "discount"} onOpenChange={(o) => !o && setDialog(null)}>
            <DialogContent className="sm:max-w-xl">
              {dialog === "edit" ? <EditResellerForm reseller={r} onDone={() => setDialog(null)} /> : null}
              {dialog === "markup" ? <MarkupForm reseller={r} onDone={() => setDialog(null)} /> : null}
              {dialog === "wallet" ? <WalletCreditForm reseller={r} onDone={() => setDialog(null)} /> : null}
              {dialog === "discount" ? <DiscountForm discount={null} resellerId={r.id} onDone={() => setDialog(null)} /> : null}
            </DialogContent>
          </Dialog>
          <ConfirmDialog
            open={dialog === "status"}
            onOpenChange={(o) => !o && setDialog(null)}
            title={r.status === "active" ? `Suspend ${r.companyName}?` : `Reactivate ${r.companyName}?`}
            description={
              r.status === "active"
                ? "The whole team loses access at once and nothing can be sold. Their eSIMs keep working; running plans keep being charged."
                : "The reseller and their assistants can sign in and sell again."
            }
            confirmLabel={r.status === "active" ? "Suspend reseller" : "Reactivate reseller"}
            destructive={r.status === "active"}
            requireReason
            onConfirm={async ({ reason }) => {
              const next = r.status === "active" ? "suspended" : "active";
              const res = await run(() => peopleApi.setResellerStatus(r.id, { status: next, reason: reason ?? "" }), { success: next === "suspended" ? "Reseller suspended" : "Reseller reactivated" });
              if (res.ok) setDialog(null);
            }}
          />
        </>
      ) : null}
      </FitScroll>
    </FitPage>
  );
}

function OverviewTab({ reseller }: { reseller: Reseller }) {
  const period = useMemo(() => periodFor("30d"), []);
  const { data } = useResource(() => dashboardApi.getDashboard(period, { resellerId: reseller.id }), [reseller.id]);
  const usage = (data?.usage ?? []).map((u) => ({
    label: formatAxisDate(u.bucket),
    final: u.estimatedBytes ? null : Math.round(toUnit(u.finalBytes, "GB") * 100) / 100,
    estimated: u.estimatedBytes ? Math.round(toUnit(u.finalBytes + u.estimatedBytes, "GB") * 100) / 100 : null,
  }));
  return (
    <div className="flex flex-col gap-4">
      <GlassCard className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <StatBlock label="eSIMs" value={reseller.esimCount} />
        <StatBlock label="Active eSIMs" value={data?.stats.activeEsims ?? 0} loading={!data} />
        <StatBlock label="Data used, 30 days" value={data ? toUnit(data.stats.dataUsedBytes, "GB") : 0} format={(n) => `${n.toFixed(1)} GB`} loading={!data} />
        <StatBlock label="Customers" value={reseller.customerCount} />
      </GlassCard>
      <UsageAreaChart data={usage} unit="GB" title="Data usage, last 30 days" description="GB per day; the dashed part is estimated until the nightly report" />
    </div>
  );
}

function EsimsTab({ id }: { id: string }) {
  const router = useRouter();
  const { data, loading, error } = useResource(() => esimsApi.listEsims({ resellerId: id }), [id]);
  return (
    <DataTable
      rows={data?.data}
      loading={loading}
      error={error}
      columns={esimColumns({ reseller: false })}
      rowKey={(e) => e.id}
      onRowClick={(e) => router.push(`/esim/esims/${e.id}`)}
      caption="eSIMs"
      empty={{ title: "No eSIMs yet", description: "eSIMs this reseller sells appear here.", illustration: "sim" }}
    />
  );
}

function CustomersTab({ id }: { id: string }) {
  const { data, loading, error } = useResource(() => peopleApi.listCustomers({ resellerId: id }), [id]);
  const columns: Column<Customer>[] = [
    { id: "name", header: "Name", cell: (c) => <span className="font-medium">{c.name}</span>, sortValue: (c) => c.name, hideable: false },
    { id: "email", header: "Email", cell: (c) => c.email, sortValue: (c) => c.email },
    { id: "phone", header: "Phone", cell: (c) => c.phone },
    { id: "esims", header: "eSIMs", align: "right", cell: (c) => c.esimCount, sortValue: (c) => c.esimCount },
    { id: "since", header: "Since", cell: (c) => formatDate(c.createdAt), sortValue: (c) => c.createdAt },
  ];
  return <DataTable rows={data} loading={loading} error={error} columns={columns} rowKey={(c) => c.id} caption="Customers" empty={{ title: "No customers yet", description: "Customers are added when selling an eSIM." }} />;
}

function WalletTab({ reseller }: { reseller: Reseller }) {
  const walletId = reseller.wallet.walletId;
  const holds = useResource(() => walletsApi.listWalletHolds(walletId, "live"), [walletId]);
  const ledger = useResource(() => walletsApi.listTransactions({ walletId, pageSize: 100 }), [walletId]);
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-3 text-section font-semibold">Holds</h2>
        <HoldsTable rows={holds.data} loading={holds.loading} empty="No running or waiting plans" />
      </section>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-section font-semibold">Ledger</h2>
          <Button asChild variant="link" size="sm">
            <Link href={`/esim/wallets/${walletId}`}>Open the wallet</Link>
          </Button>
        </div>
        <DataTable rows={ledger.data?.data} loading={ledger.loading} columns={ledgerColumns({ wallet: false })} rowKey={(l) => l.id} pageSize={10} caption="Ledger" empty={{ title: "No transactions", description: "Top-ups and usage charges appear here." }} />
      </section>
    </div>
  );
}

function DiscountsTab({ id, onAdd }: { id: string; onAdd?: () => void }) {
  const { data, loading } = useResource(() => catalogueApi.listDiscounts(), ["discounts"]);
  const rows = (data ?? []).filter((d) => d.resellerId === id);
  const columns: Column<Discount>[] = [
    { id: "plan", header: "Applies to", cell: (d) => d.planName ?? "All plans", hideable: false },
    { id: "pct", header: "Discount", align: "right", cell: (d) => `${d.percent}%` },
    { id: "since", header: "Since", cell: (d) => formatDate(d.createdAt) },
  ];
  return (
    <DataTable
      rows={data ? rows : undefined}
      loading={loading}
      columns={columns}
      rowKey={(d) => d.id}
      caption="Discounts"
      actions={
        onAdd ? (
          <Button size="sm" onClick={onAdd}>
            <Plus strokeWidth={1.75} />
            Add discount
          </Button>
        ) : undefined
      }
      empty={{ title: "No discounts", description: "This reseller pays the full markup price.", illustration: "signal" }}
    />
  );
}

function AssistantsTab({ id }: { id: string }) {
  const { data, loading } = useResource(() => peopleApi.listAssistants({ resellerId: id }), [id]);
  const columns: Column<Assistant>[] = [
    { id: "name", header: "Name", cell: (a) => <span className="flex flex-col"><span className="font-medium">{a.fullName}</span><span className="text-small text-fg-3">{a.username}</span></span>, sortValue: (a) => a.fullName, hideable: false },
    { id: "status", header: "Status", cell: (a) => <StatusChip status={USER_STATUS[a.status]} /> },
    { id: "areas", header: "Access", cell: (a) => { const c = enabledCount(a.grants, RESELLER_MATRIX); return `${c.enabled} of ${c.total} areas`; } },
    { id: "last", header: "Last sign-in", cell: (a) => <span className="text-fg-2">{a.lastSignInAt ? formatRelative(a.lastSignInAt) : "Never"}</span> },
  ];
  return <DataTable rows={data} loading={loading} columns={columns} rowKey={(a) => a.id} caption="Assistants" empty={{ title: "No assistants", description: "The reseller adds assistants from their Team page." }} />;
}

function DocumentsTab({ reseller }: { reseller: Reseller }) {
  const { me } = usePlatform();
  const { data, loading } = useResource(() => peopleApi.listResellerDocuments(reseller.id), [reseller.id]);
  const download = async (d: DocumentRow) => {
    if (!me) return;
    try {
      await exportPdf({
        fileName: `${d.number}.pdf`,
        title: `${d.title} · ${d.number}`,
        subtitle: `${reseller.companyName} · issued ${formatDate(d.issuedAt)} · demo document`,
        columns: [
          { header: "Document", value: (x: DocumentRow) => x.title },
          { header: "Number", value: (x: DocumentRow) => x.number },
          { header: "Issued", value: (x: DocumentRow) => formatDate(x.issuedAt) },
          { header: "Amount (EUR)", value: (x: DocumentRow) => Number(x.amount).toFixed(2) },
        ],
        rows: [d],
        watermark: { fullName: me.fullName, username: me.username },
      });
      await logDownload(d.kind, d.number);
      toast.success("PDF downloaded");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const columns: Column<DocumentRow>[] = [
    { id: "number", header: "Number", cell: (d) => <span className="font-mono text-small">{d.number}</span>, sortValue: (d) => d.number, hideable: false },
    { id: "title", header: "Document", cell: (d) => d.title, sortValue: (d) => d.title },
    { id: "amount", header: "Amount", align: "right", cell: (d) => formatMoney(d.amount), sortValue: (d) => toNumber(d.amount) },
    { id: "issued", header: "Issued", cell: (d) => formatDate(d.issuedAt), sortValue: (d) => d.issuedAt },
    {
      id: "dl",
      header: "",
      align: "right",
      hideable: false,
      cell: (d) => (
        <Button variant="ghost" size="sm" onClick={() => download(d)}>
          <FileDown strokeWidth={1.5} />
          PDF
        </Button>
      ),
    },
  ];
  return (
    <DataTable
      rows={data}
      loading={loading}
      columns={columns}
      rowKey={(d) => d.id}
      defaultSort={{ id: "issued", desc: true }}
      caption="Documents"
      toolbar={<p className="text-small text-fg-3">Every PDF carries a “Downloaded by” watermark, and downloads are audit-logged.</p>}
      empty={{ title: "No documents yet", description: "Statements are issued monthly; receipts when a top-up is approved." }}
    />
  );
}

function AuditTab({ id }: { id: string }) {
  const { data, loading } = useResource(() => peopleApi.listResellerAudit(id), [id]);
  const columns: Column<AuditEntry>[] = [
    { id: "at", header: "When", cell: (a) => <span className="text-fg-2" title={formatDateTime(a.createdAt)}>{formatRelative(a.createdAt)}</span>, sortValue: (a) => a.createdAt, hideable: false },
    { id: "who", header: "Who", cell: (a) => a.actor, sortValue: (a) => a.actor },
    { id: "what", header: "What", cell: (a) => a.summary },
    { id: "action", header: "Action", cell: (a) => <span className="font-mono text-small text-fg-3">{a.action}</span>, defaultHidden: true },
  ];
  return <DataTable rows={data} loading={loading} columns={columns} rowKey={(a) => a.id} defaultSort={{ id: "at", desc: true }} caption="Audit trail" empty={{ title: "Nothing recorded yet", description: "Changes to this reseller appear here." }} />;
}

